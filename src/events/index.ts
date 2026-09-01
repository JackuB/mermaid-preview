import { App } from "@slack/bolt";

import { detectMermaidSourceInSlackMessage } from "../mermaid";
import {
  buildRenderErrorText,
  renderMermaidToPng,
  uploadRenderedImageToThread,
} from "../rendering";

export default function initializeMessageListeners(app: App) {
  app.message(async ({ message, client, logger }) => {
    const subtype = "subtype" in message ? message.subtype : undefined;
    const userId =
      "user" in message && typeof message.user === "string"
        ? message.user
        : undefined;
    // Bolt's default ignoreSelf middleware filters this app's own bot ID.
    const isBotMessage = subtype === "bot_message";

    if (
      !("text" in message) ||
      typeof message.text !== "string" ||
      (subtype !== undefined && !isBotMessage) ||
      (!isBotMessage && !userId)
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

    try {
      const { png, mermaidGenerationTimeMs } =
        await renderMermaidToPng(mermaidSource);
      logger.info(
        `Created automatically detected Mermaid PNG in ${mermaidGenerationTimeMs}ms`,
      );

      await uploadRenderedImageToThread(client, message.channel, threadTs, png);
    } catch (error) {
      logger.error("Failed to render Mermaid diagram from message", error);
      await client.chat.postMessage({
        channel: message.channel,
        thread_ts: threadTs,
        text: buildRenderErrorText(error as Error),
      });
    }
  });
}
