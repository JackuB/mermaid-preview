// TODO: use TS :sob:
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { App, LogLevel } = require('@slack/bolt');
const mermaidCLI = import('@mermaid-js/mermaid-cli');
const installationStore = require('./installationStore');

const app = new App({
  logLevel: process.env.DEBUG ? LogLevel.DEBUG : LogLevel.INFO,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  installerOptions: {
    // State verification sounds like something that should be enabled for OAuth, but there is a bunch of oddities and error you encounter
    // https://github.com/slackapi/bolt-js/issues/1316
    // https://github.com/slackapi/bolt-js/issues/1355
    stateVerification: false,
    directInstall: true,
  },
  scopes: [
    'channels:history',
    'channels:join',
    'chat:write',
    'commands',
    'files:write',
    'groups:history',
    'im:history',
    'im:write',
    'mpim:history',
  ],
  customRoutes: [
    {
      path: '/serve-mermaid/:id',
      method: ['GET'],
      handler: (req, res) => {
        // TODO: verify :id is valid
        return res.sendFile(
          path.resolve(dataDir + '/' + req.params.id + '/output.png')
        );
      },
    },
  ],
  installationStore,
  port: process.env.PORT || 3000,

  // Enable the following when using socket mode
  // socketMode: true, // add this
  // appToken: process.env.SLACK_APP_TOKEN, // add this
});

const dataDir = './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// TODO: something related to this app!
const defaultMermaid = `graph LR\n  ...`;

app.command('/mermaid', async ({ client, ack, body, logger }) => {
  logger.info('mermaid command called');
  try {
    await ack();
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'mermaid-modal-submitted',
        private_metadata: JSON.stringify({
          user_id: body.user_id,
          channel: body.channel_id,
          response_url: body.response_url,
        }),
        title: {
          type: 'plain_text',
          text: 'Create a Mermaid diagram',
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':bulb: Use a tool like <https://mermaid.live|Mermaid.live> to preview your Mermaid before posting',
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
  }
});

app.view('mermaid-modal-submitted', async ({ ack, body, logger, client }) => {
  let tempDir;
  logger.info('mermaid modal submitted');
  const origin = JSON.parse(body.view.private_metadata);
  try {
    await ack();
    const inputMermaid =
      body.view.state.values['mermaid-form']['mermaid-input'].value;
    const id = crypto.randomBytes(16).toString('hex');
    tempDir = dataDir + '/' + id;
    await fs.mkdirSync(tempDir);
    const inputPath = path.resolve(tempDir + '/input.mmd');
    const outputPath = path.resolve(tempDir + '/output.png');
    fs.writeFileSync(inputPath, inputMermaid);

    logger.info('saved mermaid to ' + outputPath);

    // TODO: handle private channel - bot needs to be invited, or act in a limited functionality with response_url only
    // TODO: handle DM - https://api.slack.com/methods/conversations.open could handle it, but it's a bit awkward
    // TODO: handle group DM?
    // Try joining the channel, if it fails, open a DM
    let userChannel;
    try {
      await client.conversations.join({
        channel: origin.channel,
      });
    } catch (error) {
      // TODO: Detect private channel and don't try user DM
      logger.error('Failed to join a channel, trying user', error);
      // try {
      //   userChannel = await client.conversations.open({
      //     users: origin.user_id,
      //   });
      // } catch (error) {
      //   logger.error('Failed to open an user channel', error);
      // }
    }

    await (
      await mermaidCLI
    ).run(inputPath, outputPath, {
      outputFormat: 'png',
      parseMMDOptions: {
        viewport: {
          width: 2048,
          height: 2048,
        },
      },
      puppeteerConfig: {
        headless: 'new',
        args: ['--no-sandbox'], // I couldn't figure out how to run this in a container without this
      },
    });

    let channelToUpload = origin.channel;
    if (userChannel) {
      channelToUpload = userChannel.channel.id;
    }
    // uploadV2 is not returning a ts I need to thread the message
    const diagramUpload = await client.files.upload({
      channels: channelToUpload,
      file: fs.createReadStream(outputPath),
      filename: 'mermaid.png',
      initial_comment: `<@${origin.user_id}> created this Mermaid diagram:`,
      title: 'Mermaid diagram',
    });

    for (const shareType of Object.keys(diagramUpload.file.shares)) {
      for (const shareChannel of Object.keys(
        diagramUpload.file.shares[shareType]
      )) {
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
    fs.rmSync(tempDir, { recursive: true });
  } catch (error) {
    logger.error(error);
    if (tempDir) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    }
    // TODO: specific error messages for common errors
    await axios.post(origin.response_url, {
      text: 'Failed to generate mermaid diagram: `' + error.message + '`',
    });
  }
});

(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})();
