import { App } from "@slack/bolt";
import { extractMermaidSourceFromSlackText } from "../mermaid";
import { buildMermaidModalView } from "../modal";
import { PrivateDataObject } from "../types";

export default function initializeActionListeners(app: App) {
  app.action(
    "edit-mermaid-diagram",
    async ({ ack, body, client, logger, respond }) => {
      await ack();

      if (body.type !== "block_actions") {
        return;
      }

      const message = body.message;
      const channel = body.channel?.id;
      const parentTs = message?.thread_ts as string | undefined;
      // The source lives in the section block's text, not `message.text`
      // (which is just the fallback/notification string we posted).
      const sourceBlockText = (
        message?.blocks as
          | Array<{ type: string; text?: { text?: string } }>
          | undefined
      )?.find((block) => block.type === "section")?.text?.text;
      const source = sourceBlockText
        ? extractMermaidSourceFromSlackText(sourceBlockText)
        : null;

      if (!source || !parentTs || !channel || !message) {
        await respond({
          response_type: "ephemeral",
          text: "Couldn't find the diagram source for this button. Something's out of sync — try recreating the diagram.",
        });
        return;
      }

      try {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: buildMermaidModalView(
            {
              user_id: body.user.id,
              channel,
              response_url: body.response_url,
              invocation_id: 1,
              edit: {
                messageTs: message.ts,
                parentTs,
              },
            } as PrivateDataObject,
            { title: "Edit a Mermaid diagram", initialValue: source }
          ),
        });
      } catch (error) {
        logger.error(error);
        await respond({
          response_type: "ephemeral",
          text: `Failed to open the edit dialog: \`${
            (error as Error).message
          }\``,
        });
      }
    }
  );
}
