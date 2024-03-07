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

        /**
         * Note about DMs:
         * I've tried making Mermaid Preview respond to DMs, but I don't think it's currently possible with Slack API.
         *
         * What I've tried:
         *
         * ## Upload a file directly to the DM
         * This is not allowed with Slack API.
         *
         * ## Respond as a bot to the user
         * Use the `client.conversations.open`, to get a DM between the user and the bot.
         * I can upload a file there, but the message opens in a "App Home > Messages". Outside of the (self) DM, so I needed to redirect user there 🙄.
         * But this is breaking Slack guidelines, so I couldn't get the app approved for the App Directory 🙄.
         * This worked fairly well, but it's not a good user experience.
         *
         * ## Upload a file, then share it back to the user
         * I tried to upload a file to Slack, and use its private URL or ID to share it back to the user.
         * I could get the URL, but it was a private URL, so the user couldn't access it.
         * My bot can't call `client.files.sharedPublicURL` to make the image public, because it's limited for User tokens.
         * I can respond to the user directly with `response_url`, but no way to share the file back to the user.
         *
         * Only way I can imagine this working with how Slack defines its API is to host rendered images on a [my] server, and share a link to it.
         * I want to avoid it at all costs.
         *
         * For this reason, I need to stop the bot from responding to DMs.
         */
        if (body.channel_id.startsWith('D')) {
          logger.info('Direct message detected, exiting...');
          return await respond(
            "Apologies, Mermaid Preview can't be used in direct messages, Slack bots can't reply directly to DMs with rendered previews. Please use it in a channel."
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
