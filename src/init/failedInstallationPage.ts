import * as fs from 'fs';
import * as path from 'path';

const headerHTML = fs
  .readFileSync(
    path.resolve(__dirname, '../../public/default-header.html'),
    'utf8'
  )
  .replace(/__TITLE__/g, 'Error');

const footerHTML = fs.readFileSync(
  path.resolve(__dirname, '../../public/default-footer.html'),
  'utf8'
);

export const failedInstallationPageHTML = `${headerHTML}<p><a href="/">Mermaid Preview</a> app for Slack was not installed.</p>
  <p>You can try to <a href="/">install Mermaid Preview</a> again!</p>${footerHTML}`;
