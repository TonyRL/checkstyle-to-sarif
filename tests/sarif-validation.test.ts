import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { convertCheckstyleToSarif } from '../src/index.js';
import type { Log } from '../src/types/sarif.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

function parseSarif(xml: string): Log {
  return JSON.parse(convertCheckstyleToSarif(xml));
}

// ─── SARIF v2.1.0 Compliance Tests ───────────────────────────────────────────
describe('SARIF v2.1.0 compliance', () => {
  describe('Root object (§3.13)', () => {
    it('has required "version" property equal to "2.1.0"', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      expect(sarif.version).toBe('2.1.0');
    });

    it('has required "runs" property that is an array', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      expect(Array.isArray(sarif.runs)).toBe(true);
    });

    it('"runs" array contains at least one element', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      expect(sarif.runs.length).toBeGreaterThanOrEqual(1);
    });

    it('optionally references the SARIF schema URI (§3.13.3)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      if (sarif.$schema !== undefined) {
        expect(sarif.$schema).toContain('sarif');
        expect(sarif.$schema).toContain('2.1.0');
      }
    });
  });

  describe('Run object (§3.14)', () => {
    it('each run has required "tool" property', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        expect(run.tool).toBeDefined();
      }
    });

    it('each run has "results" array', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        expect(Array.isArray(run.results)).toBe(true);
      }
    });

    it('run specifies valid "columnKind" when present (§3.14.17)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        if (run.columnKind !== undefined) {
          expect(['utf16CodeUnits', 'unicodeCodePoints']).toContain(run.columnKind);
        }
      }
    });
  });

  describe('Tool object (§3.18)', () => {
    it('tool has required "driver" property (§3.18.2)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        expect(run.tool.driver).toBeDefined();
      }
    });

    it('tool.driver has required "name" property (§3.19.8)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        expect(typeof run.tool.driver.name).toBe('string');
        expect(run.tool.driver.name.length).toBeGreaterThan(0);
      }
    });

    it('tool.driver "version" is a string when present (§3.19.13)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        if (run.tool.driver.version !== undefined) {
          expect(typeof run.tool.driver.version).toBe('string');
        }
      }
    });

    it('tool.driver "rules" is an array when present (§3.19.23)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        if (run.tool.driver.rules !== undefined) {
          expect(Array.isArray(run.tool.driver.rules)).toBe(true);
        }
      }
    });

    it('each rule has required "id" property (§3.49.3)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        for (const rule of run.tool.driver.rules ?? []) {
          expect(typeof rule.id).toBe('string');
          expect(rule.id.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Result object (§3.27)', () => {
    it('each result has required "message" property (§3.27.11)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        for (const result of run.results) {
          expect(result.message).toBeDefined();
          // message must have at least one of: text, id, markdown
          const hasContent =
            result.message.text !== undefined ||
            result.message.id !== undefined ||
            result.message.markdown !== undefined;
          expect(hasContent).toBe(true);
        }
      }
    });

    it('result "level" is a valid value when present (§3.27.10)', () => {
      const validLevels = ['error', 'warning', 'note', 'none'];
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        for (const result of run.results) {
          if (result.level !== undefined) {
            expect(validLevels).toContain(result.level);
          }
        }
      }
    });

    it('result "ruleId" is a string when present (§3.27.5)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        for (const result of run.results) {
          if (result.ruleId !== undefined) {
            expect(typeof result.ruleId).toBe('string');
          }
        }
      }
    });

    it('result "ruleIndex" is a non-negative integer when present (§3.27.6)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        for (const result of run.results) {
          if (result.ruleIndex !== undefined) {
            expect(Number.isInteger(result.ruleIndex)).toBe(true);
            expect(result.ruleIndex).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    it('result "locations" is an array when present (§3.27.12)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        for (const result of run.results) {
          if (result.locations !== undefined) {
            expect(Array.isArray(result.locations)).toBe(true);
          }
        }
      }
    });
  });

  describe('Location object (§3.28)', () => {
    it('physicalLocation is an object when present (§3.28.3)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        for (const result of run.results) {
          for (const loc of result.locations ?? []) {
            if (loc.physicalLocation !== undefined) {
              expect(typeof loc.physicalLocation).toBe('object');
            }
          }
        }
      }
    });

    it('artifactLocation has a "uri" string when present (§3.4.3)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        for (const result of run.results) {
          for (const loc of result.locations ?? []) {
            const artLoc = loc.physicalLocation?.artifactLocation;
            if (artLoc?.uri !== undefined) {
              expect(typeof artLoc.uri).toBe('string');
            }
          }
        }
      }
    });
  });

  describe('Region object (§3.30)', () => {
    it('region "startLine" is a positive integer when present (§3.30.5)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        for (const result of run.results) {
          for (const loc of result.locations ?? []) {
            const region = loc.physicalLocation?.region;
            if (region?.startLine !== undefined) {
              expect(Number.isInteger(region.startLine)).toBe(true);
              expect(region.startLine).toBeGreaterThanOrEqual(1);
            }
          }
        }
      }
    });

    it('region "startColumn" is a positive integer when present (§3.30.6)', () => {
      const sarif = parseSarif(loadFixture('valid-checkstyle.xml'));
      for (const run of sarif.runs) {
        for (const result of run.results) {
          for (const loc of result.locations ?? []) {
            const region = loc.physicalLocation?.region;
            if (region?.startColumn !== undefined) {
              expect(Number.isInteger(region.startColumn)).toBe(true);
              expect(region.startColumn).toBeGreaterThanOrEqual(1);
            }
          }
        }
      }
    });
  });

  describe('Severity mapping compliance', () => {
    it('maps Checkstyle error → SARIF error', () => {
      const xml = loadFixture('multiple-severities.xml');
      const sarif = parseSarif(xml);
      const errorResult = sarif.runs[0].results.find((r) => r.level === 'error');
      expect(errorResult).toBeDefined();
    });

    it('maps Checkstyle warning → SARIF warning', () => {
      const xml = loadFixture('multiple-severities.xml');
      const sarif = parseSarif(xml);
      const warningResult = sarif.runs[0].results.find((r) => r.level === 'warning');
      expect(warningResult).toBeDefined();
    });

    it('maps Checkstyle info → SARIF note', () => {
      const xml = loadFixture('multiple-severities.xml');
      const sarif = parseSarif(xml);
      const noteResult = sarif.runs[0].results.find((r) => r.level === 'note');
      expect(noteResult).toBeDefined();
    });

    it('maps Checkstyle ignore → SARIF none', () => {
      const xml = loadFixture('multiple-severities.xml');
      const sarif = parseSarif(xml);
      const noneResult = sarif.runs[0].results.find((r) => r.level === 'none');
      expect(noneResult).toBeDefined();
    });
  });

  describe('Full pipeline compliance', () => {
    it('produces a fully-compliant SARIF document from valid-checkstyle.xml', () => {
      const xml = loadFixture('valid-checkstyle.xml');
      const sarif = parseSarif(xml);

      // version
      expect(sarif.version).toBe('2.1.0');
      // runs
      expect(sarif.runs).toHaveLength(1);
      const run = sarif.runs[0];
      // tool
      expect(run.tool.driver.name).toBeTruthy();
      // results count
      expect(run.results).toHaveLength(6);
      // all results have message.text
      for (const result of run.results) {
        expect(result.message.text).toBeTruthy();
      }
      // all results have at least one location
      for (const result of run.results) {
        expect(result.locations?.length).toBeGreaterThan(0);
      }
      // all locations have startLine >= 1
      for (const result of run.results) {
        for (const loc of result.locations ?? []) {
          expect(loc.physicalLocation?.region?.startLine).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('produces valid SARIF from empty-checkstyle.xml', () => {
      const xml = loadFixture('empty-checkstyle.xml');
      const sarif = parseSarif(xml);
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs[0].results).toHaveLength(0);
    });

    it('produces valid SARIF from single-error.xml', () => {
      const xml = loadFixture('single-error.xml');
      const sarif = parseSarif(xml);
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs[0].results).toHaveLength(1);

      const result = sarif.runs[0].results[0];
      expect(result.message.text).toBeTruthy();
      expect(result.level).toBe('error');
      expect(result.locations?.[0]?.physicalLocation?.region?.startLine).toBe(5);
      expect(result.locations?.[0]?.physicalLocation?.region?.startColumn).toBe(3);
    });
  });
});
