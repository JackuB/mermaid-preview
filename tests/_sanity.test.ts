import { expect, test, vi } from 'vitest';
import customRoutes from '../src/init/customRoutes';
import initializeCommandListeners from '../src/commands';
import initializeViews from '../src/views';
import initializeActionListeners from '../src/actions';

// Sanity check for Jest TS config
test('customRoutes Bolt.js config exports a single route', () => {
  expect(customRoutes.length).toEqual(1);
});

// Importing the listener modules above already fails this file if one of
// them depends on a package that's no longer installed (e.g. a transitive
// dependency dropped by a Bolt upgrade).
test('all Slack listeners register on the app', () => {
  const app = { command: vi.fn(), view: vi.fn(), action: vi.fn() };
  initializeCommandListeners(app as any);
  initializeViews(app as any);
  initializeActionListeners(app as any);

  expect(app.command).toHaveBeenCalledWith('/mermaid', expect.any(Function));
  expect(app.view).toHaveBeenCalledWith(
    'mermaid-modal-submitted',
    expect.any(Function)
  );
  expect(app.action).toHaveBeenCalledWith(
    'edit-mermaid-diagram',
    expect.any(Function)
  );
});
