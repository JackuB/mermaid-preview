const mermaid = import('mermaid');
const mermaidCLIModule = import('@mermaid-js/mermaid-cli');

export async function isMermaidInputValid(
  mermaidInput: string
): Promise<boolean> {
  // Gotta love ESM...
  const mermaidInstance = (await mermaid) as any;
  const isMermaidInputValid = await mermaidInstance.default.parse(
    mermaidInput,
    {
      suppressErrors: true,
    }
  );
  return !!isMermaidInputValid;
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
        args: ['--no-sandbox'], // I couldn't figure out how to run this in a container without this
      },
    }
  );
}
