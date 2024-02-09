import { App } from '@slack/bolt';
import { defaultMermaid, mermaidPreviewHintText } from '../mermaid';
import { PrivateDataObject } from '../types';

export default function initializeCommandListeners(app: App) {
  app.command(
    '/mermaid',
    async function ({ client, ack, body, logger, respond }) {
      logger.info('mermaid command called', JSON.stringify(body, null, 2));
      try {
        await ack();
        if (body.text) {
          return await respond(
            `${
              body.text.trim() === 'help' ? '' : 'Unknown command\n\n'
            }*Mermaid Preview* is a Slack app that allows you to generate previews Mermaid diagrams in Slack. See <http://mermaid-js.github.io/mermaid/#/|Mermaid documentation> for more information. Run \`/mermaid\` for an interactive dialog.\n\n${mermaidPreviewHintText}`
          );
        }
        const invocationId = 1;
        await client.views.open({
          trigger_id: body.trigger_id,
          view: {
            type: 'modal',
            callback_id: 'mermaid-modal-submitted',
            private_metadata: JSON.stringify({
              user_id: body.user_id,
              channel: body.channel_id,
              response_url: body.response_url,
              invocation_id: invocationId,
            } as PrivateDataObject),
            title: {
              type: 'plain_text',
              text: 'Create a Mermaid diagram',
            },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: mermaidPreviewHintText,
                },
              },
              {
                type: 'input',
                block_id: 'mermaid-form',
                element: {
                  type: 'plain_text_input',
                  multiline: true,
                  focus_on_load: true,
                  action_id: 'mermaid-input',
                  placeholder: {
                    type: 'plain_text',
                    text: defaultMermaid,
                  },
                },
                label: {
                  type: 'plain_text',
                  text: 'Mermaid diagram',
                },
              },
            ],
            submit: {
              type: 'plain_text',
              text: 'Submit',
            },
          },
        });
      } catch (error) {
        logger.error(error);
        return await respond(
          `Failed to open Mermaid Preview dialog: \`${
            (error as Error).message
          }\``
        );
      }
    }
  );
}
