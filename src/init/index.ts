import * as fs from "fs";
import { App } from "@slack/bolt";

import logger, { logLevel } from "../logger";

import installationStore from "./installationStore";
import customRoutes from "./customRoutes";
import scopes from "./scopes";
import { failedInstallationPageHTML } from "./failedInstallationPage";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function getApp(): Promise<App> {
  logger.debug("getApp: fetching installation store...");
  const store = await installationStore();
  logger.debug("getApp: installation store ready, constructing App...");
  const app = new App({
    logLevel,
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
          logger.error("Failed installation", error, _installOptions);
          res.statusCode = 200;
          res.end(failedInstallationPageHTML);
        },
      },
    },
    scopes,
    customRoutes,
    installationStore: store,
    port,
    // Enable the following when using socket mode
    // socketMode: true, // add this
    // appToken: process.env.SLACK_APP_TOKEN, // add this
  });
  logger.debug("getApp: App constructed");
  return app;
}

const dataDir = "./data";
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

export { getApp, dataDir };
