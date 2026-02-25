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
  if (!source) {
    return 'UnknownRule';
  }
  const parts = source.split('.');
  return parts[parts.length - 1] ?? source;
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
  const results: Result[] = [];

  for (const file of checkstyle.file) {
    const fileUri = pathToUri(file.name);

    for (const error of file.error) {
      const ruleId = extractRuleId(error.source);
      const level = mapSeverityToLevel(error.severity);

      // Register rule if not already seen
      if (!ruleMap.has(ruleId)) {
        const rule: ReportingDescriptor = {
          id: ruleId,
          ...(error.source && {
            helpUri: `https://checkstyle.org/checks/${ruleId.toLowerCase()}.html`,
          }),
        };
        ruleMap.set(ruleId, rule);
      }

      const ruleIndex = [...ruleMap.keys()].indexOf(ruleId);

      const location: Location = {
        physicalLocation: {
          artifactLocation: {
            uri: fileUri,
          },
          region: {
            startLine: error.line,
            ...(error.column !== undefined && error.column > 0 ? { startColumn: error.column } : {}),
          },
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
        ...(toolVersion !== undefined ? { version: toolVersion } : {}),
        ...(checkstyle.version !== undefined ? { version: checkstyle.version } : {}),
        informationUri: 'https://checkstyle.org',
        rules: rules.length > 0 ? rules : undefined,
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
