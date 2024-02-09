import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { expect, describe, it } from 'vitest';
import { isMermaidInputValid, renderMermaidToFile } from '../src/mermaid';
import validDiagrams from './valid-diagrams/valid-diagrams';

describe('isMermaidInputValid', () => {
  for (const diagramType of validDiagrams) {
    it(`returns true for valid ${diagramType.type}`, async () => {
      const result = await isMermaidInputValid(diagramType.input);
      expect(result).toBe(true);
    });
  }

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
  for (const diagramType of validDiagrams) {
    it(`creates a file for valid ${diagramType.type}`, async () => {
      const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'mermaid-preview-test-')
      );
      // Local output
      // let tmpDir = './test-tmp';
      // if (!fs.existsSync('./test-tmp')) {
      //   fs.mkdirSync('./test-tmp');
      // }

      const inputPath = path.resolve(tmpDir + `/input-${diagramType.type}.mmd`);
      const outputPath = path.resolve(
        tmpDir + `/output-${diagramType.type}.png`
      );

      const outputExistsBeforeTest = fs.existsSync(outputPath);
      expect(outputExistsBeforeTest).toBe(false);
      fs.writeFileSync(inputPath, diagramType.input);

      await renderMermaidToFile(inputPath, outputPath);

      const outputExistsAfterTest = fs.existsSync(outputPath);
      expect(outputExistsAfterTest).toBe(true);
    });
  }
}, 30000);
