import * as fs from 'fs';
import * as path from 'path';
import { type CustomRoute } from '@slack/bolt';

// I can't really get Bolt.js to serve static files, without replacing the whole OAuth/Express app
// If this approach would be an issue, I could setup a CDN/reverse proxy just for the statics
const indexHTML = fs.readFileSync(
  path.resolve(__dirname, '../public/index.html')
);
const policyTXT = fs.readFileSync(
  path.resolve(__dirname, '../public/policy.txt')
);
const screenshotJPEG = fs.readFileSync(
  path.resolve(__dirname, '../public/mermaid-for-slack-preview-screenshot.jpg')
);

const customRoutes: CustomRoute[] = [
  {
    path: '/',
    method: ['GET'],
    handler: (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(indexHTML);
    },
  },
  {
    path: '/privacy',
    method: ['GET'],
    handler: (req, res) => {
      res.setHeader('Content-Type', 'text/plain');
      res.end(policyTXT);
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
];

export default customRoutes;
