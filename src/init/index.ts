import * as fs from "fs";
import { App, LogLevel } from "@slack/bolt";

import installationStore from "./installationStore";
import customRoutes from "./customRoutes";
import scopes from "./scopes";
import { failedInstallationPageHTML } from "./failedInstallationPage";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function getApp(): Promise<App> {
  return new App({
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
      callbackOptions: {
        failure: (error, _installOptions, req, res) => {
          console.log("Failed installation", error, _installOptions);
          res.statusCode = 200;
          res.end(failedInstallationPageHTML);
        },
      },
    },
    scopes,
    customRoutes,
    installationStore: await installationStore(),
    port,
    // Enable the following when using socket mode
    // socketMode: true, // add this
    // appToken: process.env.SLACK_APP_TOKEN, // add this
  });
}

const dataDir = "./data";
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

export { getApp, dataDir };
