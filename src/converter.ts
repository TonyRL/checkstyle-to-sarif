import { SarifBuilder, SarifResultBuilder, SarifRuleBuilder, SarifRunBuilder } from 'node-sarif-builder';

import type { CheckstyleError, CheckstyleReport } from './types/checkstyle.js';
import type { Log, Result } from './types/sarif.js';

/**
 * Maps a Checkstyle severity string to a SARIF result level.
 */
function mapSeverityToLevel(severity: CheckstyleError['severity']): Result.level {
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
export function convertToSarif(checkstyle: CheckstyleReport, toolVersion?: string): Log {
  // Create SARIF builder
  const sarifBuilder = new SarifBuilder();

  // Create SARIF run builder
  const version = toolVersion ?? checkstyle.version;
  const sarifRunBuilder = new SarifRunBuilder().initSimple({
    toolDriverName: 'Checkstyle',
    toolDriverVersion: version ?? '',
    url: 'https://checkstyle.org',
  });

  // Set columnKind
  sarifRunBuilder.run.columnKind = 'utf16CodeUnits';

  // Remove version if empty string (when neither toolVersion nor checkstyle.version is set)
  if (version === undefined) {
    delete sarifRunBuilder.run.tool.driver.version;
  }

  // Collect unique rules from all errors
  const ruleIds = new Set<string>();

  for (const file of checkstyle.file) {
    const fileUri = pathToUri(file.name);

    for (const error of file.error) {
      const ruleId = extractRuleId(error.source);
      const level = mapSeverityToLevel(error.severity);

      // Register rule if not already seen
      if (!ruleIds.has(ruleId)) {
        const sarifRuleBuilder = new SarifRuleBuilder().initSimple({
          ruleId,
          shortDescriptionText: ruleId,
          helpUri: `https://checkstyle.org/checks/${ruleId.toLowerCase()}.html`,
        });
        sarifRunBuilder.addRule(sarifRuleBuilder);
        ruleIds.add(ruleId);
      }

      // Create SARIF result
      const sarifResultBuilder = new SarifResultBuilder();
      const hasColumn = typeof error.column === 'number' && error.column > 0;
      const sarifResultInit: {
        level: Result.level;
        messageText: string;
        ruleId: string;
        fileUri: string;
        startLine?: number;
        startColumn?: number;
      } = {
        level,
        messageText: error.message,
        ruleId,
        fileUri,
        startLine: error.line,
      };

      // Only include column if present and greater than 0
      if (hasColumn) {
        sarifResultInit.startColumn = error.column;
      }

      sarifResultBuilder.initSimple(sarifResultInit);

      // node-sarif-builder sets default column values to 1, we need to remove them
      // if the original data didn't have column information
      if (!hasColumn) {
        const region = sarifResultBuilder.result.locations?.[0]?.physicalLocation?.region;
        if (region) {
          delete region.startColumn;
          delete region.endColumn;
        }
      }

      sarifRunBuilder.addResult(sarifResultBuilder);
    }
  }

  // Add run to SARIF log
  sarifBuilder.addRun(sarifRunBuilder);

  // Build SARIF log
  const log = sarifBuilder.buildSarifOutput();

  // Update $schema to match expected SARIF v2.1.0 schema
  log.$schema = 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/cos02/schemas/sarif-schema-2.1.0.json';

  return log;
}
