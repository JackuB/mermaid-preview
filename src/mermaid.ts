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
      console.error('Mermaid parsing error', error);
    }
  }
  console.log('🚀 ~ isMermaidInputValid:', mermaidInput, isMermaidInputValid);
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

export async function renderMermaidToFile(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await (
    await mermaidCLIModule
  ).run(
    inputPath,
    // @ts-ignore - ignoring a type for .png pattern in outputPath
    outputPath,
    {
      outputFormat: 'png',
      parseMMDOptions: {
        viewport: {
          width: 2048,
          height: 2048,
        },
      },
      puppeteerConfig: {
        headless: 'new',
        executablePath: process.env.CHROME_BIN
          ? process.env.CHROME_BIN
          : undefined,
        args: ['--no-sandbox', '--disable-gpu'], // I couldn't figure out how to run this in a container without this
      },
    }
  );
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
