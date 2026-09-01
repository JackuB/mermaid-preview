import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { WebClient } from "@slack/web-api";

import { dataDir } from "./init";
import { mermaidPreviewHintText, renderMermaidToFile } from "./mermaid";
import * as telemetry from "./telemetry";

export async function renderMermaidToPng(mermaidSource: string): Promise<{
  png: Buffer;
  mermaidGenerationTimeMs: number;
}> {
  const tempDir = path.join(dataDir, crypto.randomUUID());
  await fs.promises.mkdir(tempDir);

  try {
    const inputPath = path.join(tempDir, "input.mmd");
    const outputPath = path.join(tempDir, "output.png");
    await fs.promises.writeFile(inputPath, mermaidSource);

    const startTime = performance.now();
    await renderMermaidToFile(inputPath, outputPath);
    const mermaidGenerationTimeMs = performance.now() - startTime;

    telemetry.send("render", {
      mermaidGenerationTimeMs,
      mermaidLength: mermaidSource.length,
    });

    return {
      png: await fs.promises.readFile(outputPath),
      mermaidGenerationTimeMs,
    };
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

export async function attachRenderedImage(
  client: WebClient,
  channel: string,
  ts: string,
  comment: string,
  png: Buffer,
) {
  const uploadResult = await client.filesUploadV2({
    file: png,
    filename: "mermaid.png",
  });
  const fileId = uploadResult.files?.[0]?.files?.[0]?.id;
  if (!fileId) {
    throw new Error("Failed to get an id for the uploaded file");
  }

  await client.chat.update({
    channel,
    ts,
    text: comment,
    file_ids: [fileId],
  });
}

export function buildRenderErrorText(error: Error): string {
  if (error.message.startsWith("Evaluation failed: ")) {
    const userFriendlyError = error.message
      .replace(/    at .*$/gm, "")
      .replace(/^Evaluation failed: /, "")
      .replace(/^\n$/gm, "");
    return `Failed to generate mermaid diagram. Is your diagram valid?\n\n\`\`\`${userFriendlyError}\`\`\`${mermaidPreviewHintText}`;
  }
  return "Failed to generate mermaid diagram: ```" + error.message + "```";
}
