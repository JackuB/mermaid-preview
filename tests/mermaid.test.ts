import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { expect, describe, it } from 'vitest';
import { isMermaidInputValid, renderMermaidToFile } from '../src/mermaid';

describe('isMermaidInputValid', () => {
  it('returns true for valid input', async () => {
    const validMermaid = `
    graph TD;
      A-->B;
      A-->C;
      B-->D;
      C-->D;
    `;
    const result = await isMermaidInputValid(validMermaid);
    expect(result).toBe(true);
  });

  it('returns false for empty input', async () => {
    const empty = ``;
    const result = await isMermaidInputValid(empty);
    expect(result).toBe(false);
  });

  it('returns false for invalid input', async () => {
    const invalidInput = `not a diagram`;
    const result = await isMermaidInputValid(invalidInput);
    expect(result).toBe(false);
  });

  it('returns false for broken input', async () => {
    const broken = `
    graph TD;
      A-->B;
      A-->;
      B-->D;
      C-->D;
    `;
    const result = await isMermaidInputValid(broken);
    expect(result).toBe(false);
  });
});

describe('renderMermaidToFile', () => {
  it('creates a file on specified output location', async () => {
    const validMermaid = `
    graph TD;
      A-->B;
      A-->C;
      B-->D;
      C-->D;
    `;

    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'mermaid-preview-test-')
    );

    const inputPath = path.resolve(tmpDir + '/input.mmd');
    const outputPath = path.resolve(tmpDir + '/output.png');

    const outputExistsBeforeTest = fs.existsSync(outputPath);
    expect(outputExistsBeforeTest).toBe(false);
    fs.writeFileSync(inputPath, validMermaid);

    await renderMermaidToFile(inputPath, outputPath);

    const outputExistsAfterTest = fs.existsSync(outputPath);
    expect(outputExistsAfterTest).toBe(true);
  });
}, 30000);
