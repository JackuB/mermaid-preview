import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import { App } from '@slack/bolt';

import { PrivateDataObject } from '../types';
import {
  isMermaidInputValid,
  mermaidPreviewHintText,
  renderMermaidToFile,
} from '../mermaid';
import { dataDir } from '../init';

export default function initializeViews(app: App) {
  app.view('mermaid-modal-submitted', async ({ ack, body, logger, client }) => {
    let tempDir;
    logger.info('mermaid modal submitted');
    const origin: PrivateDataObject = JSON.parse(body.view.private_metadata);
    try {
      await ack();
      const inputMermaid =
        body.view.state.values['mermaid-form']['mermaid-input'].value;
      if (!inputMermaid) {
        await axios.post(origin.response_url, {
          text: "Mermaid diagram can't be empty",
        });
        return;
      }

      const validMermaid = await isMermaidInputValid(inputMermaid);
      if (!validMermaid) {
        await axios.post(origin.response_url, {
          text: `Mermaid diagram is invalid.\n${mermaidPreviewHintText}`,
        });
        return;
      }
      const id = crypto.randomUUID();
      tempDir = dataDir + '/' + id;
      await fs.mkdirSync(tempDir);
      const inputPath = path.resolve(tempDir + '/input.mmd');
      const outputPath = path.resolve(tempDir + '/output.png');
      fs.writeFileSync(inputPath, inputMermaid);

      logger.info('saved mermaid to ' + inputPath);

      // TODO: handle private channel - bot needs to be invited, or act in a limited functionality with response_url only
      // TODO: handle DM - https://api.slack.com/methods/conversations.open could handle it, but it's a bit awkward
      // TODO: handle group DM?
      // Try joining the channel, if it fails, open a DM

      let channelToUpload: string = origin.channel;

      // Check for direct message
      if (origin.channel.startsWith('D')) {
        logger.info('Direct message detected');
        try {
          const userChannel = await client.conversations.open({
            users: origin.user_id,
          });
          channelToUpload = userChannel.channel?.id
            ? userChannel.channel.id
            : channelToUpload;
          logger.info('User channel', userChannel);
          logger.info('Channel selected', channelToUpload);
        } catch (error) {
          logger.error('Failed to open an user channel, but continuing', error);
        }
      } else {
        try {
          await client.conversations.join({
            channel: origin.channel,
          });
        } catch (error) {
          // Joining a private channel can be tricky...
          logger.error('Failed to join channel, stopping', error);
          // Expected Slack API errors give us a message
          if ((error as any).data) {
            switch ((error as any).data.error) {
              case 'channel_not_found':
                await axios.post(origin.response_url, {
                  text: "Mermaid Preview can't automatically join private channels. If it's a private channel, please invite Mermaid bot to it.",
                });
                return; // Exit in this case
              case 'method_not_supported_for_channel_type':
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
              text:
                'Failed to join channel: `' + (error as Error).message + '`',
            });
            return; // Exit in this case
          }
        }
      }

      // measure time of this await
      const startTime = performance.now();
      await renderMermaidToFile(inputPath, outputPath);
      const endTime = performance.now();

      const mermaidGenerationTimeMs = endTime - startTime;
      logger.info(
        'Created PNG in ' +
          mermaidGenerationTimeMs +
          'ms and saved it to ' +
          outputPath
      );

      // uploadV2 is not returning a ts I need to thread the message
      const diagramUpload = await client.files.upload({
        channels: channelToUpload,
        file: fs.createReadStream(outputPath),
        filename: 'mermaid.png',
        initial_comment: `<@${origin.user_id}> created this Mermaid diagram:`,
        title: 'Mermaid diagram',
      });

      // If user runs /mermaid in self-DM, post a message to the Mermaid Preview channel!
      // This is a weird interaction, but that's the Slack-way.
      if (
        channelToUpload.startsWith('D') &&
        origin.channel !== channelToUpload
      ) {
        await axios.post(origin.response_url, {
          text: `Mermaid diagram uploaded to <#${channelToUpload}>:`,
        });
      }

      if (diagramUpload.file?.shares) {
        const shareKeys = Object.keys(diagramUpload.file.shares);
        for (const shareType of shareKeys) {
          for (const shareChannel of Object.keys(
            // @ts-ignore
            diagramUpload.file.shares[shareType]
          )) {
            // @ts-ignore
            for (const share of diagramUpload.file.shares[shareType][
              shareChannel
            ]) {
              await client.files.upload({
                channels: shareChannel,
                content: inputMermaid,
                initial_comment: 'Mermaid document for the diagram above:',
                thread_ts: share.ts,
                filename: 'mermaid.mmd',
                filetype: 'text',
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error(error);
      logger.error('error.name', (error as Error).name);
      logger.error('error.message', (error as Error).message);
      // "Known" error from Mermaid CLI
      if ((error as Error).message.startsWith('Evaluation failed: ')) {
        const userFriendlyError = (error as Error).message
          .replace(/    at .*$/gm, '') // remove stack trace
          .replace(/^Evaluation failed: /, '')
          .replace(/^\n$/gm, '');
        await axios.post(origin.response_url, {
          text: `Failed to generate mermaid diagram. Is your diagram valid?\n\n\`\`\`${userFriendlyError}\`\`\`${mermaidPreviewHintText}`,
        });
      } else {
        await axios.post(origin.response_url, {
          text:
            'Failed to generate mermaid diagram: ```' +
            (error as Error).message +
            '```',
        });
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
