import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { convertCheckstyleToSarif, parseCheckstyleXml, convertToSarif } from '../src/index.js';
import type { Log } from '../src/types/sarif.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('convertCheckstyleToSarif', () => {
  it('returns a valid JSON string', () => {
    const xml = loadFixture('valid-checkstyle.xml');
    const result = convertCheckstyleToSarif(xml);

    expect(typeof result).toBe('string');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('output is valid SARIF v2.1.0 JSON', () => {
    const xml = loadFixture('valid-checkstyle.xml');
    const result = convertCheckstyleToSarif(xml);
    const sarif: Log = JSON.parse(result);

    expect(sarif.version).toBe('2.1.0');
    expect(Array.isArray(sarif.runs)).toBe(true);
    expect(sarif.runs.length).toBeGreaterThan(0);
  });

  it('converts empty checkstyle to SARIF with empty results', () => {
    const xml = loadFixture('empty-checkstyle.xml');
    const result = convertCheckstyleToSarif(xml);
    const sarif: Log = JSON.parse(result);

    expect(sarif.runs[0].results).toHaveLength(0);
  });

  it('preserves all violations from valid checkstyle', () => {
    const xml = loadFixture('valid-checkstyle.xml');
    const result = convertCheckstyleToSarif(xml);
    const sarif: Log = JSON.parse(result);

    // valid-checkstyle.xml has 3 + 2 + 1 = 6 errors total
    expect(sarif.runs[0].results).toHaveLength(6);
  });

  it('uses 2-space indentation by default', () => {
    const xml = loadFixture('single-error.xml');
    const result = convertCheckstyleToSarif(xml);
    expect(result).toMatch(/^{\n  "/);
  });

  it('allows custom indentation', () => {
    const xml = loadFixture('single-error.xml');
    const result = convertCheckstyleToSarif(xml, 4);
    expect(result).toMatch(/^{\n    "/);
  });

  it('propagates parser errors', () => {
    expect(() => convertCheckstyleToSarif('')).toThrow();
    expect(() => convertCheckstyleToSarif('<notcheckstyle/>')).toThrow();
  });

  it('exports are all accessible', () => {
    expect(typeof convertCheckstyleToSarif).toBe('function');
    expect(typeof parseCheckstyleXml).toBe('function');
    expect(typeof convertToSarif).toBe('function');
  });
});
