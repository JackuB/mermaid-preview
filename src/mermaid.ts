const mermaid = import("mermaid");
const mermaidCLIModule = import("@mermaid-js/mermaid-cli");

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
    if ((error as Error).message === "DOMPurify.addHook is not a function") {
      return true;
    } else {
      console.error("Mermaid parsing error", error);
    }
  }
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
      outputFormat: "png",
      parseMMDOptions: {
        viewport: {
          width: 2048,
          height: 2048,
        },
      },
      puppeteerConfig: {
        headless: "new",
        executablePath: process.env.CHROME_BIN
          ? process.env.CHROME_BIN
          : undefined,
        args: ["--no-sandbox", "--disable-gpu"], // I couldn't figure out how to run this in a container without this
      },
    }
  );
}

export const mermaidPreviewHintText =
  ":bulb: Use a tool like <https://mermaid.live|Mermaid.live> to preview your Mermaid before posting";

export const defaultMermaid = `graph TD;
  A---B
  A---C
  B---D
  C---D`;
