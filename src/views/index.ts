import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import axios from "axios";
import { App } from "@slack/bolt";
import { WebClient } from "@slack/web-api";

import { PrivateDataObject } from "../types";
import {
  buildMermaidSourceReplyBlocks,
  isMermaidInputValid,
  mermaidPreviewHintText,
  renderMermaidToFile,
} from "../mermaid";
import * as telemetry from "../telemetry";
import { dataDir } from "../init";

// Attaches a rendered PNG to an existing message. Used both for editing an
// already-posted diagram, and for the initial post, since chat.postMessage
// reliably returns a `ts` up front, whereas filesUploadV2's own response
// doesn't reliably tell us the ts of the message it just created.
async function attachRenderedImage(
  client: WebClient,
  channel: string,
  ts: string,
  comment: string,
  outputPath: string
) {
  const uploadResult = await client.filesUploadV2({
    file: outputPath,
    filename: "mermaid.png",
  });
  const fileId = uploadResult.files?.[0]?.files?.[0]?.id;
  if (!fileId) {
    throw new Error("Failed to get an id for the uploaded file");
  }

  await client.chat.update({
    channel,
    ts,
    text: comment,
    file_ids: [fileId],
  });
}

function buildErrorText(error: Error): string {
  // "Known" error from Mermaid CLI
  if (error.message.startsWith("Evaluation failed: ")) {
    const userFriendlyError = error.message
      .replace(/    at .*$/gm, "") // remove stack trace
      .replace(/^Evaluation failed: /, "")
      .replace(/^\n$/gm, "");
    return `Failed to generate mermaid diagram. Is your diagram valid?\n\n\`\`\`${userFriendlyError}\`\`\`${mermaidPreviewHintText}`;
  }
  return "Failed to generate mermaid diagram: ```" + error.message + "```";
}

export default function initializeViews(app: App) {
  app.view("mermaid-modal-submitted", async ({ ack, body, logger, client }) => {
    let tempDir;
    logger.info("mermaid modal submitted");
    const origin: PrivateDataObject = JSON.parse(body.view.private_metadata);
    const inputMermaid =
      body.view.state.values["mermaid-form"]["mermaid-input"].value;

    // Validate before ack()-ing, so we can report problems inline in the
    // modal (response_action: "errors") instead of closing it. This keeps
    // the user's draft on screen and never touches the posted message.
    if (!inputMermaid) {
      await ack({
        response_action: "errors",
        errors: { "mermaid-form": "Mermaid diagram can't be empty" },
      });
      return;
    }

    const validMermaid = await isMermaidInputValid(inputMermaid);
    if (!validMermaid) {
      await ack({
        response_action: "errors",
        errors: {
          "mermaid-form":
            "Mermaid diagram is invalid. Try previewing it at https://mermaid.live first.",
        },
      });
      return;
    }

    await ack();

    // Set once we've posted a "rendering..." placeholder message (create
    // flow only), so failures can update that placeholder instead of
    // falling back to response_url.
    let placeholderMessage: { channel: string; ts: string } | undefined;
    try {
      const id = crypto.randomUUID();
      tempDir = dataDir + "/" + id;
      await fs.mkdirSync(tempDir);
      const inputPath = path.resolve(tempDir + "/input.mmd");
      const outputPath = path.resolve(tempDir + "/output.png");
      fs.writeFileSync(inputPath, inputMermaid);
      logger.info("saved mermaid to " + inputPath);

      let channelToUpload: string = origin.channel;

      try {
        await client.conversations.join({
          channel: origin.channel,
        });
      } catch (error) {
        // Joining a private channel can be tricky...
        logger.error("Failed to join channel, stopping", error);
        // Expected Slack API errors give us a message
        if ((error as any).data) {
          switch ((error as any).data.error) {
            case "channel_not_found":
              await axios.post(origin.response_url, {
                text: "Mermaid Preview can't automatically join private channels. If it's a private channel, please invite Mermaid bot to it.",
              });
              return; // Exit in this case
            case "method_not_supported_for_channel_type":
              // Mermaid is already in the channel, so we can continue
              break;
            default:
              await axios.post(origin.response_url, {
                text: `Failed to join channel: \`${
                  (error as Error).message || error
                } \``,
              });
              return; // Exit in this case
          }
        } else {
          await axios.post(origin.response_url, {
            text: "Failed to join channel: `" + (error as Error).message + "`",
          });
          return; // Exit in this case
        }
      }

      const comment = `<@${origin.user_id}> created this Mermaid diagram:`;

      // Show a placeholder right away, since rendering can take a while.
      // For edits, the existing message already has a good image on it —
      // give feedback via an ephemeral instead of overwriting it, so a
      // failed re-render doesn't clobber the last-good diagram.
      let targetMessage: { channel: string; ts: string };
      if (origin.edit) {
        await client.chat.postEphemeral({
          channel: channelToUpload,
          user: origin.user_id,
          text: "⏳ Re-rendering Mermaid diagram...",
        });
        targetMessage = { channel: channelToUpload, ts: origin.edit.parentTs };
      } else {
        const posted = await client.chat.postMessage({
          channel: channelToUpload,
          text: "⏳ Rendering Mermaid diagram...",
        });
        if (!posted.ts) {
          throw new Error("Failed to get ts for posted message");
        }
        placeholderMessage = { channel: channelToUpload, ts: posted.ts };
        targetMessage = placeholderMessage;
      }

      // measure time of this await
      const startTime = performance.now();
      await renderMermaidToFile(inputPath, outputPath);
      const endTime = performance.now();

      const mermaidGenerationTimeMs = endTime - startTime;
      logger.info(
        "Created PNG in " +
          mermaidGenerationTimeMs +
          "ms and saved it to " +
          outputPath
      );
      telemetry.send("render", {
        mermaidGenerationTimeMs,
        mermaidLength: inputMermaid.length,
      });

      // The placeholder/target message above already gave us a ts to
      // attach the rendered image to.
      await attachRenderedImage(
        client,
        targetMessage.channel,
        targetMessage.ts,
        comment,
        outputPath
      );

      const sourceBlocks = buildMermaidSourceReplyBlocks(inputMermaid);
      if (origin.edit) {
        // Refresh the existing source reply, instead of posting a new one.
        await client.chat.update({
          channel: channelToUpload,
          ts: origin.edit.messageTs,
          text: "Mermaid diagram source",
          blocks: sourceBlocks,
        });
      } else {
        await client.chat.postMessage({
          channel: targetMessage.channel,
          thread_ts: targetMessage.ts,
          text: "Mermaid diagram source",
          blocks: sourceBlocks,
        });
      }
    } catch (error) {
      logger.error(error);
      logger.error("error.name", (error as Error).name);
      logger.error("error.message", (error as Error).message);
      const errorText = buildErrorText(error as Error);
      if (origin.edit) {
        // Leave the existing message (image + source) untouched, and just
        // tell the editing user what went wrong.
        await client.chat.postEphemeral({
          channel: origin.channel,
          user: origin.user_id,
          text: errorText,
        });
      } else if (placeholderMessage) {
        // Nothing valuable on this message yet — safe to overwrite in place.
        await client.chat.update({
          channel: placeholderMessage.channel,
          ts: placeholderMessage.ts,
          text: errorText,
        });
      } else {
        await axios.post(origin.response_url, { text: errorText });
      }
    } finally {
      if (tempDir) {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true });
        }
      }
    }
  });
}
