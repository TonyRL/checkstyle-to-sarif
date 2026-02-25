import { describe, it, expect } from 'vitest';

import { convertToSarif } from '../src/converter.js';
import type { CheckstyleReport } from '../src/types/checkstyle.js';

function makeReport(overrides?: Partial<CheckstyleReport>): CheckstyleReport {
  return {
    version: '10.3.4',
    file: [],
    ...overrides,
  };
}

describe('convertToSarif', () => {
  describe('root SARIF structure', () => {
    it('produces a valid SARIF v2.1.0 root structure', () => {
      const sarif = convertToSarif(makeReport());

      expect(sarif.version).toBe('2.1.0');
      expect(sarif.$schema).toContain('sarif-schema-2.1.0');
      expect(Array.isArray(sarif.runs)).toBe(true);
      expect(sarif.runs).toHaveLength(1);
    });

    it('run contains required tool.driver.name', () => {
      const sarif = convertToSarif(makeReport());
      const run = sarif.runs[0];

      expect(run.tool).toBeDefined();
      expect(run.tool.driver).toBeDefined();
      expect(run.tool.driver.name).toBe('Checkstyle');
    });

    it('run contains results array', () => {
      const sarif = convertToSarif(makeReport());
      const run = sarif.runs[0];

      expect(Array.isArray(run.results)).toBe(true);
    });

    it('run specifies columnKind', () => {
      const sarif = convertToSarif(makeReport());
      const run = sarif.runs[0];

      expect(run.columnKind).toBe('utf16CodeUnits');
    });

    it('includes Checkstyle version from report', () => {
      const sarif = convertToSarif(makeReport({ version: '10.3.4' }));
      expect(sarif.runs[0].tool.driver.version).toBe('10.3.4');
    });

    it('does not include version when not in report', () => {
      const sarif = convertToSarif(makeReport({ version: undefined }));
      expect(sarif.runs[0].tool.driver.version).toBeUndefined();
    });
  });

  describe('empty results', () => {
    it('produces empty results array when report has no files', () => {
      const sarif = convertToSarif(makeReport({ file: [] }));
      expect(sarif.runs[0].results).toHaveLength(0);
    });

    it('produces empty results array when files have no errors', () => {
      const report = makeReport({
        file: [{ name: 'Clean.java', error: [] }],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results).toHaveLength(0);
    });
  });

  describe('severity → level mapping', () => {
    const severityCases: Array<[CheckstyleReport['file'][0]['error'][0]['severity'], string]> = [
      ['error', 'error'],
      ['warning', 'warning'],
      ['info', 'note'],
      ['ignore', 'none'],
    ];

    for (const [checkstyleSeverity, expectedLevel] of severityCases) {
      it(`maps '${checkstyleSeverity}' to SARIF level '${expectedLevel}'`, () => {
        const report = makeReport({
          file: [
            {
              name: 'Foo.java',
              error: [
                {
                  line: 1,
                  severity: checkstyleSeverity,
                  message: 'Test',
                  source: 'com.example.TestCheck',
                },
              ],
            },
          ],
        });
        const sarif = convertToSarif(report);
        expect(sarif.runs[0].results[0].level).toBe(expectedLevel);
      });
    }

    it('maps unknown severity to SARIF warning', () => {
      const error: CheckstyleReport['file'][0]['error'][0] = {
        line: 1,
        severity: 'error',
        message: 'Test',
        source: 'com.example.TestCheck',
      };
      // Override with an unknown severity value to test edge case handling
      Object.assign(error, { severity: 'custom' });

      const report = makeReport({
        file: [
          {
            name: 'Foo.java',
            error: [error],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].level).toBe('warning');
    });
  });

  describe('result location', () => {
    it('maps line and column to SARIF region', () => {
      const report = makeReport({
        file: [
          {
            name: 'Foo.java',
            error: [
              {
                line: 42,
                column: 7,
                severity: 'error',
                message: 'Test',
                source: 'com.example.TestCheck',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const location = sarif.runs[0].results[0].locations?.[0];
      const region = location?.physicalLocation?.region;

      expect(region?.startLine).toBe(42);
      expect(region?.startColumn).toBe(7);
    });

    it('does not include startColumn when column is missing', () => {
      const report = makeReport({
        file: [
          {
            name: 'Foo.java',
            error: [
              {
                line: 10,
                severity: 'warning',
                message: 'Test',
                source: 'com.example.TestCheck',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const region = sarif.runs[0].results[0].locations?.[0]?.physicalLocation?.region;
      expect(region?.startLine).toBe(10);
      expect(region?.startColumn).toBeUndefined();
    });

    it('converts absolute Unix path to file:// URI', () => {
      const report = makeReport({
        file: [
          {
            name: '/home/user/project/Foo.java',
            error: [
              {
                line: 1,
                severity: 'error',
                message: 'Test',
                source: 'com.example.TestCheck',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const uri = sarif.runs[0].results[0].locations?.[0]?.physicalLocation?.artifactLocation?.uri;
      expect(uri).toBe('file:///home/user/project/Foo.java');
    });

    it('keeps relative paths as-is', () => {
      const report = makeReport({
        file: [
          {
            name: 'src/Foo.java',
            error: [
              {
                line: 1,
                severity: 'error',
                message: 'Test',
                source: 'com.example.TestCheck',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const uri = sarif.runs[0].results[0].locations?.[0]?.physicalLocation?.artifactLocation?.uri;
      expect(uri).toBe('src/Foo.java');
    });
  });

  describe('ruleId extraction', () => {
    it('extracts the class name as ruleId from source', () => {
      const report = makeReport({
        file: [
          {
            name: 'Foo.java',
            error: [
              {
                line: 1,
                severity: 'error',
                message: 'Test',
                source: 'com.puppycrawl.tools.checkstyle.checks.coding.FallThroughCheck',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].ruleId).toBe('FallThroughCheck');
    });

    it('uses UnknownRule when source is undefined', () => {
      const report = makeReport({
        file: [
          {
            name: 'Foo.java',
            error: [
              {
                line: 1,
                severity: 'error',
                message: 'Test',
                source: '',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].ruleId).toBe('UnknownRule');
    });

    it('uses full source as ruleId when no dots present', () => {
      const report = makeReport({
        file: [
          {
            name: 'Foo.java',
            error: [
              {
                line: 1,
                severity: 'error',
                message: 'Test',
                source: 'SimpleCheck',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].ruleId).toBe('SimpleCheck');
    });

    it('deduplicates rules with the same ruleId', () => {
      const report = makeReport({
        file: [
          {
            name: 'Foo.java',
            error: [
              {
                line: 1,
                severity: 'error',
                message: 'First',
                source: 'com.example.SameCheck',
              },
              {
                line: 2,
                severity: 'warning',
                message: 'Second',
                source: 'com.example.SameCheck',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const rules = sarif.runs[0].tool.driver.rules;
      const sameCheckRules = rules?.filter((r) => r.id === 'SameCheck') ?? [];
      expect(sameCheckRules).toHaveLength(1);
    });

    it('produces correct ruleIndex pointing to rules array', () => {
      const report = makeReport({
        file: [
          {
            name: 'Foo.java',
            error: [
              {
                line: 1,
                severity: 'error',
                message: 'Check A',
                source: 'com.example.CheckA',
              },
              {
                line: 2,
                severity: 'warning',
                message: 'Check B',
                source: 'com.example.CheckB',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const rules = sarif.runs[0].tool.driver.rules ?? [];
      const results = sarif.runs[0].results;

      expect(rules[results[0].ruleIndex ?? -1].id).toBe('CheckA');
      expect(rules[results[1].ruleIndex ?? -1].id).toBe('CheckB');
    });
  });

  describe('message', () => {
    it('includes message.text in result', () => {
      const report = makeReport({
        file: [
          {
            name: 'Foo.java',
            error: [
              {
                line: 1,
                severity: 'error',
                message: 'Something went wrong',
                source: 'com.example.TestCheck',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].message.text).toBe('Something went wrong');
    });
  });

  describe('multiple files', () => {
    it('flattens results from multiple files into a single results array', () => {
      const report = makeReport({
        file: [
          {
            name: 'A.java',
            error: [{ line: 1, severity: 'error', message: 'A error', source: 'com.Check' }],
          },
          {
            name: 'B.java',
            error: [
              { line: 2, severity: 'warning', message: 'B warning', source: 'com.Check2' },
              { line: 3, severity: 'info', message: 'B info', source: 'com.Check3' },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results).toHaveLength(3);
    });
  });

  describe('Windows path conversion', () => {
    it('converts Windows absolute path to file:// URI', () => {
      const report = makeReport({
        file: [
          {
            name: 'C:\\Users\\foo\\Bar.java',
            error: [
              {
                line: 1,
                severity: 'error',
                message: 'Test',
                source: 'com.example.TestCheck',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      const uri = sarif.runs[0].results[0].locations?.[0]?.physicalLocation?.artifactLocation?.uri;
      expect(uri).toBe('file:///C:/Users/foo/Bar.java');
    });
  });

  describe('empty source handling', () => {
    it('uses UnknownRule when source is empty string', () => {
      const report = makeReport({
        file: [
          {
            name: 'Foo.java',
            error: [
              {
                line: 1,
                severity: 'warning',
                message: 'No source',
                source: '',
              },
            ],
          },
        ],
      });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].results[0].ruleId).toBe('UnknownRule');
    });
  });

  describe('toolVersion parameter', () => {
    it('toolVersion parameter takes precedence over checkstyle.version', () => {
      const report = makeReport({ version: '10.3.4' });
      report.file = [
        {
          name: 'Foo.java',
          error: [
            { line: 1, severity: 'error', message: 'Test', source: 'com.Check' },
          ],
        },
      ];
      const sarif = convertToSarif(report, '99.0.0');
      expect(sarif.runs[0].tool.driver.version).toBe('99.0.0');
    });

    it('falls back to checkstyle.version when toolVersion is not provided', () => {
      const report = makeReport({ version: '10.3.4' });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].tool.driver.version).toBe('10.3.4');
    });

    it('omits version when neither toolVersion nor checkstyle.version is set', () => {
      const report = makeReport({ version: undefined });
      const sarif = convertToSarif(report);
      expect(sarif.runs[0].tool.driver.version).toBeUndefined();
    });
  });
});
