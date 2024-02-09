import customRoutes from '../src/customRoutes';

// Sanity check for Jest TS config
test('customRoutes Bolt.js config exports a single route', () => {
  expect(customRoutes.length).toEqual(1);
});
