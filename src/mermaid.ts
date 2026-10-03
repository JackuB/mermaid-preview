import * as fs from 'fs';
import puppeteer, { type Browser } from 'puppeteer';
import logger from './logger';

const mermaid = import('mermaid');
const mermaidCLIModule = import('@mermaid-js/mermaid-cli');

export async function isMermaidInputValid(
  mermaidInput: string
): Promise<boolean> {
  // Gotta love ESM...
  const mermaidInstance = (await mermaid) as any;
  let isMermaidInputValid = false;
  try {
    isMermaidInputValid = await mermaidInstance.default.parse(mermaidInput, {
      suppressErrors: false, // We need to capture errors because of the DOMPurify issue
    });
  } catch (error) {
    /*
      There is an open issue with DOMPurify build
      https://github.com/mermaid-js/mermaid/issues/5204
      So the diagram might be valid, but the parsing will fail
      It is a specific case, so we are just going to log the error
      Validation works for other types
    */
    if (
      (error as Error).message === 'DOMPurify.addHook is not a function' ||
      (error as Error).message === 'DOMPurify.sanitize is not a function'
    ) {
      return true;
    } else {
      logger.debug('Mermaid parsing error:', (error as Error).message);
    }
  }
  return !!isMermaidInputValid;
}

// Matches a complete Markdown code fence (any or no language tag) around
// the entire input, capturing the code body.
const codeFencePattern =
  /^\s*```[ \t]*(?:[a-zA-Z][a-zA-Z0-9_-]*[ \t]*)?\r?\n([\s\S]*?)\r?\n[ \t]*```\s*$/;

export function stripCodeFence(input: string): string {
  const match = codeFencePattern.exec(input);
  // Normalize whichever body we end up with, so unfenced input gets the
  // same line endings and trimming as a fenced paste.
  return (match ? match[1] : input)
    .replace(/\r\n/g, '\n')
    .trim();
}

// A single Chromium instance is shared across renders, since launching one
// per render was the bulk of the render time. Each render still gets its own
// page (renderMermaid opens and closes it).
let browserPromise: Promise<Browser> | undefined;

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const launching = puppeteer
      .launch({
        headless: true,
        executablePath: process.env.CHROME_BIN
          ? process.env.CHROME_BIN
          : undefined,
        args: ['--no-sandbox', '--disable-gpu'], // I couldn't figure out how to run this in a container without this
      })
      .then((browser) => {
        // If Chromium crashes or gets killed, launch a fresh one next time.
        browser.on('disconnected', () => {
          logger.warn('Chromium disconnected, will relaunch on next render');
          if (browserPromise === launching) {
            browserPromise = undefined;
          }
        });
        logger.info('Chromium launched');
        return browser;
      });
    // Don't cache a failed launch, so the next render retries.
    launching.catch(() => {
      if (browserPromise === launching) {
        browserPromise = undefined;
      }
    });
    browserPromise = launching;
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  const launching = browserPromise;
  browserPromise = undefined;
  if (launching) {
    await (await launching).close();
  }
}

export async function renderMermaidToFile(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const definition = fs.readFileSync(inputPath, 'utf8');
  const browser = await getBrowser();
  const { data } = await (
    await mermaidCLIModule
  ).renderMermaid(browser, definition, 'png', {
    viewport: {
      width: 2048,
      height: 2048,
    },
  });
  fs.writeFileSync(outputPath, data);
}

const sourceBlockPattern = /```\n([\s\S]*)\n```/;

export function formatMermaidSourceForSlack(mermaidSource: string): string {
  const escaped = mermaidSource
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `\`\`\`\n${escaped}\n\`\`\``;
}

export function extractMermaidSourceFromSlackText(
  text: string
): string | null {
  const match = text.match(sourceBlockPattern);
  if (!match) {
    return null;
  }
  return match[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Block Kit text objects are capped at 3000 characters, unlike a plain
// message's 40000 character limit.
const SLACK_TEXT_BLOCK_LIMIT = 3000;

export function buildMermaidSourceReplyBlocks(mermaidSource: string) {
  const formattedSource = formatMermaidSourceForSlack(mermaidSource);
  if (formattedSource.length > SLACK_TEXT_BLOCK_LIMIT) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ":warning: This diagram's source is too long to show here, so it can't be edited from this message. Run `/mermaid` again to create a new one.",
        },
      },
    ];
  }

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: formattedSource,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: 'edit-mermaid-diagram',
          text: { type: 'plain_text', text: '✏️ Edit diagram' },
        },
      ],
    },
  ];
}

export const mermaidPreviewHintText =
  ':bulb: Use a tool like <https://mermaid.live|Mermaid.live> to preview your Mermaid before posting';

export const defaultMermaid = `graph TD;
  A---B
  A---C
  B---D
  C---D`;
