import { App } from "@slack/bolt";

import { detectMermaidSourceInSlackMessage } from "../mermaid";
import {
  attachRenderedImage,
  buildRenderErrorText,
  renderMermaidToPng,
} from "../rendering";

export default function initializeMessageListeners(app: App) {
  app.message(async ({ message, client, logger }) => {
    if (
      !("text" in message) ||
      typeof message.text !== "string" ||
      !("user" in message) ||
      typeof message.user !== "string" ||
      ("subtype" in message && message.subtype !== undefined) ||
      ("bot_id" in message && message.bot_id !== undefined)
    ) {
      return;
    }

    const mermaidSource = await detectMermaidSourceInSlackMessage(message.text);
    if (!mermaidSource) {
      return;
    }

    const threadTs =
      "thread_ts" in message && message.thread_ts
        ? message.thread_ts
        : message.ts;
    let placeholderTs: string | undefined;

    try {
      const placeholder = await client.chat.postMessage({
        channel: message.channel,
        thread_ts: threadTs,
        text: "Rendering Mermaid diagram...",
      });
      placeholderTs = placeholder.ts;
      if (!placeholderTs) {
        throw new Error("Failed to get ts for posted message");
      }

      const { png, mermaidGenerationTimeMs } =
        await renderMermaidToPng(mermaidSource);
      logger.info(
        `Created automatically detected Mermaid PNG in ${mermaidGenerationTimeMs}ms`,
      );

      await attachRenderedImage(
        client,
        message.channel,
        placeholderTs,
        `<@${message.user}>'s Mermaid diagram:`,
        png,
      );
    } catch (error) {
      logger.error("Failed to render Mermaid diagram from message", error);
      if (placeholderTs) {
        await client.chat.update({
          channel: message.channel,
          ts: placeholderTs,
          text: buildRenderErrorText(error as Error),
        });
      }
    }
  });
}
