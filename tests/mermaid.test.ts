import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { expect, describe, it } from 'vitest';
import {
  isMermaidInputValid,
  renderMermaidToFile,
  stripCodeFence,
} from '../src/mermaid';
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

describe('stripCodeFence', () => {
  const source = `flowchart LR
  A --> B`;

  it('strips a ```mermaid fence around the whole input', () => {
    expect(stripCodeFence(`\`\`\`mermaid\n${source}\n\`\`\``)).toBe(source);
  });

  it('handles leading and trailing whitespace around the fenced block', () => {
    expect(stripCodeFence(`  \n\`\`\`mermaid\n${source}\n\`\`\`\n  `)).toBe(source);
  });

  it('handles CRLF line endings', () => {
    expect(
      stripCodeFence('```mermaid\r\nflowchart LR\r\nA --> B\r\n```')
    ).toBe(`flowchart LR\nA --> B`);
  });

  it('keeps backticks used within valid Mermaid source', () => {
    const withBacktick = 'graph TD; A["Use `a` arg"] --> B';
    expect(
      stripCodeFence(`\`\`\`mermaid\n${withBacktick}\n\`\`\``)
    ).toBe(withBacktick);
  });

  it('returns unwrapped input unchanged', () => {
    expect(stripCodeFence(source)).toBe(source);
  });

  it('strips a fenced block without a language tag', () => {
    expect(stripCodeFence(`\`\`\`\n${source}\n\`\`\``)).toBe(source);
  });

  it('strips a fenced block with any language tag', () => {
    expect(stripCodeFence(`\`\`\`text\n${source}\n\`\`\``)).toBe(source);
  });

  it('returns partially fenced input unchanged', () => {
    const partial = `\`\`\`mermaid\n${source}\nnot a closing fence`;
    expect(stripCodeFence(partial)).toBe(partial);
  });

  it('trims unfenced input, so blank input reads as empty', () => {
    expect(stripCodeFence('   \n  ')).toBe('');
    expect(stripCodeFence(`\n  ${source}  \n`)).toBe(source);
  });

  it('normalizes CRLF in unfenced input', () => {
    expect(stripCodeFence('flowchart LR\r\nA --> B')).toBe(
      `flowchart LR\nA --> B`
    );
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
