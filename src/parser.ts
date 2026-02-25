import { XMLParser } from 'fast-xml-parser';

import type { CheckstyleError, CheckstyleFile, CheckstyleReport } from './types/checkstyle.js';

interface RawCheckstyleError {
  '@_line'?: string | number;
  '@_column'?: string | number;
  '@_severity'?: string;
  '@_message'?: string;
  '@_source'?: string;
}

interface RawCheckstyleFile {
  '@_name'?: string;
  error?: RawCheckstyleError | RawCheckstyleError[];
}

interface RawCheckstyleRoot {
  checkstyle?: {
    '@_version'?: string;
    file?: RawCheckstyleFile | RawCheckstyleFile[];
  };
}

const ARRAY_ELEMENTS = new Set(['file', 'error']);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Only force arrays for <file> and <error> elements, never for attributes
  isArray: (name, _jpath, _isLeafNode, isAttribute) => !isAttribute && ARRAY_ELEMENTS.has(name),
  // Keep all attribute values as strings
  parseAttributeValue: false,
});

/**
 * Parses a Checkstyle XML string into a structured CheckstyleReport.
 *
 * @param xmlContent - The raw XML content from a Checkstyle report
 * @returns A structured CheckstyleReport object
 * @throws {Error} If the XML is malformed or does not match the expected Checkstyle format
 */
export function parseCheckstyleXml(xmlContent: string): CheckstyleReport {
  if (!xmlContent || xmlContent.trim() === '') {
    throw new Error('Input XML content is empty');
  }

  let parsed: RawCheckstyleRoot;
  try {
    parsed = parser.parse(xmlContent) as RawCheckstyleRoot;
  } catch (err) {
    throw new Error(`Failed to parse XML: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  if (!parsed.checkstyle) {
    throw new Error('Invalid Checkstyle XML: missing root <checkstyle> element');
  }

  const root = parsed.checkstyle;
  const rawFiles = root.file ?? [];
  const filesArray = Array.isArray(rawFiles) ? rawFiles : [rawFiles];

  const files: CheckstyleFile[] = filesArray.map((rawFile) => {
    const fileName = rawFile['@_name'] ?? '';
    const rawErrors = rawFile.error ?? [];
    const errorsArray = Array.isArray(rawErrors) ? rawErrors : [rawErrors];

    const errors: CheckstyleError[] = errorsArray
      .filter((e): e is RawCheckstyleError => e !== null && e !== undefined && typeof e === 'object')
      .map((rawError) => {
        const line = Number(rawError['@_line'] ?? 1);
        const columnRaw = rawError['@_column'];
        const column = columnRaw !== undefined ? Number(columnRaw) : undefined;
        const severity = normalizeCheckstyleSeverity(String(rawError['@_severity'] ?? 'warning'));
        const message = String(rawError['@_message'] ?? '');
        const source = String(rawError['@_source'] ?? '');

        const error: CheckstyleError = {
          line: isNaN(line) ? 1 : line,
          severity,
          message,
          source,
        };

        if (column !== undefined && !isNaN(column)) {
          error.column = column;
        }

        return error;
      });

    return { name: fileName, error: errors };
  });

  return {
    version: root['@_version'] !== undefined ? String(root['@_version']) : undefined,
    file: files,
  };
}

function normalizeCheckstyleSeverity(severity: string): CheckstyleError['severity'] {
  switch (severity.toLowerCase()) {
    case 'error':
      return 'error';
    case 'warning':
    case 'warn':
      return 'warning';
    case 'info':
      return 'info';
    case 'ignore':
      return 'ignore';
    default:
      return 'warning';
  }
}
