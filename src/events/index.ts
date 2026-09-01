import { createHash } from "crypto";
import { App } from "@slack/bolt";

import { detectMermaidSourceInSlackMessage } from "../mermaid";
import {
  buildRenderErrorText,
  renderMermaidToPng,
  uploadRenderedImageToThread,
} from "../rendering";

export default function initializeMessageListeners(app: App) {
  const renderedSources = new Set<string>();

  app.message(async ({ message, client, logger }) => {
    const isMessageChanged =
      "subtype" in message && message.subtype === "message_changed";
    const sourceMessage = isMessageChanged ? message.message : message;
    const subtype =
      "subtype" in sourceMessage ? sourceMessage.subtype : undefined;
    const userId =
      "user" in sourceMessage && typeof sourceMessage.user === "string"
        ? sourceMessage.user
        : undefined;
    // Bolt's default ignoreSelf middleware filters this app's own bot ID.
    const isBotMessage = subtype === "bot_message";

    if (
      !("text" in sourceMessage) ||
      typeof sourceMessage.text !== "string" ||
      (subtype !== undefined && !isBotMessage) ||
      (isMessageChanged && !isBotMessage) ||
      (!isBotMessage && !userId)
    ) {
      return;
    }

    const mermaidSource = await detectMermaidSourceInSlackMessage(
      sourceMessage.text,
    );
    if (!mermaidSource) {
      return;
    }

    const renderedSourceKey = createHash("sha256")
      .update(`${message.channel}\0${sourceMessage.ts}\0${mermaidSource}`)
      .digest("hex");
    if (renderedSources.has(renderedSourceKey)) {
      return;
    }
    if (renderedSources.size >= 1000) {
      const oldestKey = renderedSources.values().next().value;
      if (oldestKey) {
        renderedSources.delete(oldestKey);
      }
    }
    renderedSources.add(renderedSourceKey);

    const threadTs =
      "thread_ts" in sourceMessage && sourceMessage.thread_ts
        ? sourceMessage.thread_ts
        : sourceMessage.ts;

    try {
      const { png, mermaidGenerationTimeMs } =
        await renderMermaidToPng(mermaidSource);
      logger.info(
        `Created automatically detected Mermaid PNG in ${mermaidGenerationTimeMs}ms`,
      );

      await uploadRenderedImageToThread(client, message.channel, threadTs, png);
    } catch (error) {
      renderedSources.delete(renderedSourceKey);
      logger.error("Failed to render Mermaid diagram from message", error);
      await client.chat.postMessage({
        channel: message.channel,
        thread_ts: threadTs,
        text: buildRenderErrorText(error as Error),
      });
    }
  });
}
