console.info('Mermaid Preview is starting...');
import './instrument';
import { getApp } from './init';
import initializeViews from './views';
import initializeCommandListeners from './commands';

(async () => {
  const app = await getApp();

  initializeCommandListeners(app);
  initializeViews(app);

  await app.start();
  console.info('Mermaid Preview is running!');
})();
