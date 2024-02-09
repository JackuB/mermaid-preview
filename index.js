// TODO: use TS :sob:
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { App, LogLevel } = require('@slack/bolt');
const mermaidCLI = import('@mermaid-js/mermaid-cli');
const installationStore = require('./installationStore');

// I can't really get Bolt.js to serve static files, without replacing the whole OAuth/Express app
const indexHTML = fs.readFileSync(path.resolve('./public/index.html'));
const screenshotJPEG = fs.readFileSync(
  path.resolve('./public/mermaid-for-slack-preview-screenshot.jpg')
);

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
      path: '/',
      method: ['GET'],
      handler: (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(indexHTML);
      },
    },
    {
      path: '/mermaid-for-slack-preview-screenshot.jpg',
      method: ['GET'],
      handler: (req, res) => {
        res.setHeader('Content-Type', 'image/jpeg');
        res.end(screenshotJPEG);
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
  logger.info('mermaid command called', JSON.stringify(body, null, 2));
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

    let channelToUpload = origin.channel;

    // Check for direct message
    if (origin.channel.startsWith('D')) {
      try {
        userChannel = await client.conversations.open({
          users: origin.user_id,
        });
        channelToUpload = userChannel.channel.id;
      } catch (error) {
        logger.error('Failed to open an user channel, but continuing', error);
      }
    } else {
      try {
        await client.conversations.join({
          channel: origin.channel,
        });
      } catch (error) {
        logger.error('Failed to join channel, but continuing', error);
      }
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
  } catch (error) {
    logger.error(error);
    // TODO: specific error messages for common errors
    await axios.post(origin.response_url, {
      text: 'Failed to generate mermaid diagram: `' + error.message + '`',
    });
  } finally {
    if (tempDir) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    }
  }
});

(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})();
