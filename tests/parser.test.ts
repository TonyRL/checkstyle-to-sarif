import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { parseCheckstyleXml } from '../src/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('parseCheckstyleXml', () => {
  describe('valid input', () => {
    it('parses a valid Checkstyle XML report', () => {
      const xml = loadFixture('valid-checkstyle.xml');
      const report = parseCheckstyleXml(xml);

      expect(report.version).toBe('10.3.4');
      expect(report.file).toHaveLength(3);
    });

    it('parses file names correctly', () => {
      const xml = loadFixture('valid-checkstyle.xml');
      const report = parseCheckstyleXml(xml);

      expect(report.file[0].name).toBe('/home/user/project/src/Main.java');
      expect(report.file[1].name).toBe('/home/user/project/src/Utils.java');
      expect(report.file[2].name).toBe('/home/user/project/src/Config.java');
    });

    it('parses error attributes correctly', () => {
      const xml = loadFixture('valid-checkstyle.xml');
      const report = parseCheckstyleXml(xml);
      const firstFile = report.file[0];

      expect(firstFile.error).toHaveLength(3);

      const firstError = firstFile.error[0];
      expect(firstError.line).toBe(17);
      expect(firstError.column).toBe(17);
      expect(firstError.severity).toBe('error');
      expect(firstError.message).toBe('Fall through from previous branch of switch statement.');
      expect(firstError.source).toBe('com.puppycrawl.tools.checkstyle.checks.coding.FallThroughCheck');
    });

    it('handles missing column attribute', () => {
      const xml = loadFixture('valid-checkstyle.xml');
      const report = parseCheckstyleXml(xml);
      const fileErrors = report.file[0].error;

      // Third error has no column attribute
      const noColumnError = fileErrors[2];
      expect(noColumnError.column).toBeUndefined();
    });

    it('parses multiple severities', () => {
      const xml = loadFixture('multiple-severities.xml');
      const report = parseCheckstyleXml(xml);

      expect(report.file[0].error[0].severity).toBe('error');
      expect(report.file[1].error[0].severity).toBe('warning');
      expect(report.file[2].error[0].severity).toBe('info');
    });

    it('parses empty checkstyle report (no files)', () => {
      const xml = loadFixture('empty-checkstyle.xml');
      const report = parseCheckstyleXml(xml);

      expect(report.file).toHaveLength(0);
    });

    it('parses single error in a single file', () => {
      const xml = loadFixture('single-error.xml');
      const report = parseCheckstyleXml(xml);

      expect(report.file).toHaveLength(1);
      expect(report.file[0].error).toHaveLength(1);
      expect(report.file[0].error[0].line).toBe(5);
      expect(report.file[0].error[0].column).toBe(3);
    });

    it('decodes XML entities in messages', () => {
      const xml = loadFixture('valid-checkstyle.xml');
      const report = parseCheckstyleXml(xml);

      // Utils.java second error uses &apos;
      expect(report.file[1].error[0].message).toContain("'foo'");
    });
  });

  describe('inline XML', () => {
    it('parses inline XML string', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<checkstyle version="9.0">
  <file name="Foo.java">
    <error line="1" column="1" severity="error" message="Test error" source="com.example.TestCheck"/>
  </file>
</checkstyle>`;
      const report = parseCheckstyleXml(xml);

      expect(report.version).toBe('9.0');
      expect(report.file).toHaveLength(1);
      expect(report.file[0].name).toBe('Foo.java');
      expect(report.file[0].error[0].message).toBe('Test error');
    });

    it('handles file with no errors', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<checkstyle version="10.0">
  <file name="Clean.java">
  </file>
</checkstyle>`;
      const report = parseCheckstyleXml(xml);

      expect(report.file).toHaveLength(1);
      expect(report.file[0].error).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('throws on empty input', () => {
      expect(() => parseCheckstyleXml('')).toThrow('empty');
    });

    it('throws on whitespace-only input', () => {
      expect(() => parseCheckstyleXml('   \n   ')).toThrow('empty');
    });

    it('throws on missing <checkstyle> root element', () => {
      expect(() => parseCheckstyleXml('<root><something/></root>')).toThrow('Invalid Checkstyle XML');
    });
  });
});
