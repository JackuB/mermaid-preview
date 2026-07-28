console.info("Mermaid Preview is starting...");
import "./instrument";
import { getApp } from "./init";
import initializeViews from "./views";
import initializeCommandListeners from "./commands";
import initializeActionListeners from "./actions";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection during startup:", reason);
});

const startupWatchdog = setTimeout(() => {
  console.error("Startup watchdog: still not running after 20s");
}, 20000);

(async () => {
  console.info("index: calling getApp()");
  const app = await getApp();
  console.info("index: getApp() resolved");

  initializeCommandListeners(app);
  initializeViews(app);
  initializeActionListeners(app);
  console.info("index: listeners registered, calling app.start()");

  await app.start();
  clearTimeout(startupWatchdog);
  console.info("Mermaid Preview is running!");
})().catch((error) => {
  console.error("Fatal error during startup:", error);
  process.exit(1);
});
