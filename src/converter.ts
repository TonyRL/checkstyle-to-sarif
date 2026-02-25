import type { CheckstyleError, CheckstyleReport } from './types/checkstyle.js';
import type { Location, ReportingDescriptor, Result, ResultLevel, Run, SarifLog } from './types/sarif.js';

const SARIF_SCHEMA = 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/cos02/schemas/sarif-schema-2.1.0.json';

/**
 * Maps a Checkstyle severity string to a SARIF result level.
 */
function mapSeverityToLevel(severity: CheckstyleError['severity']): ResultLevel {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'note';
    case 'ignore':
      return 'none';
    default:
      return 'warning';
  }
}

/**
 * Converts a file path to a URI suitable for use in SARIF artifactLocation.
 * Converts backslashes to forward slashes. Absolute paths get a file:// scheme.
 */
function pathToUri(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    // Windows absolute path
    return `file:///${normalized}`;
  }
  if (normalized.startsWith('/')) {
    // Unix absolute path
    return `file://${normalized}`;
  }
  // Relative path — leave as-is so SARIF consumers can resolve via uriBaseId
  return normalized;
}

/**
 * Extracts the rule ID from a Checkstyle source class name.
 * e.g. "com.puppycrawl.tools.checkstyle.checks.coding.FallThroughCheck" → "FallThroughCheck"
 */
function extractRuleId(source: string): string {
  if (source) {
    const parts = source.split('.');
    return parts[parts.length - 1] ?? source;
  }
  return 'UnknownRule';
}

/**
 * Converts a CheckstyleReport to a SARIF log.
 *
 * @param checkstyle - The parsed Checkstyle report
 * @param toolVersion - Optional version string for the tool driver
 * @returns A structured SARIF log object
 */
export function convertToSarif(checkstyle: CheckstyleReport, toolVersion?: string): SarifLog {
  // Collect unique rules from all errors
  const ruleMap = new Map<string, ReportingDescriptor>();
  const ruleIndexMap = new Map<string, number>();
  const results: Result[] = [];

  for (const file of checkstyle.file) {
    const fileUri = pathToUri(file.name);

    for (const error of file.error) {
      const ruleId = extractRuleId(error.source);
      const level = mapSeverityToLevel(error.severity);

      // Register rule if not already seen
      let ruleIndex = ruleIndexMap.get(ruleId);
      if (ruleIndex === undefined) {
        const rule: ReportingDescriptor = {
          id: ruleId,
          ...(error.source && {
            helpUri: `https://checkstyle.org/checks/${ruleId.toLowerCase()}.html`,
          }),
        };
        ruleIndex = ruleMap.size;
        ruleIndexMap.set(ruleId, ruleIndex);
        ruleMap.set(ruleId, rule);
      }

      const region: NonNullable<Location['physicalLocation']>['region'] = {
        startLine: error.line,
      };
      if (typeof error.column === 'number' && error.column > 0) {
        region.startColumn = error.column;
      }

      const location: Location = {
        physicalLocation: {
          artifactLocation: {
            uri: fileUri,
          },
          region,
        },
      };

      const result: Result = {
        ruleId,
        ruleIndex,
        level,
        message: { text: error.message },
        locations: [location],
      };

      results.push(result);
    }
  }

  const rules = [...ruleMap.values()];

  const run: Run = {
    tool: {
      driver: {
        name: 'Checkstyle',
        ...(toolVersion === undefined
          ? checkstyle.version === undefined
            ? {}
            : { version: checkstyle.version }
          : { version: toolVersion }),
        informationUri: 'https://checkstyle.org',
        ...(rules.length > 0 ? { rules } : {}),
      },
    },
    results,
    columnKind: 'utf16CodeUnits',
  };

  const sarifLog: SarifLog = {
    version: '2.1.0',
    $schema: SARIF_SCHEMA,
    runs: [run],
  };

  return sarifLog;
}
