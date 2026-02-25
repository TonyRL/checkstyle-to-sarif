import { convertToSarif } from './converter.js';
import { parseCheckstyleXml } from './parser.js';

export { convertToSarif } from './converter.js';
export { parseCheckstyleXml } from './parser.js';
export type * from './types/checkstyle.js';
export type * from './types/sarif.js';

/**
 * Converts a Checkstyle XML string to a SARIF v2.1.0 JSON.
 *
 * @param xmlContent - Raw XML content from a Checkstyle report
 * @param indent - Number of spaces for JSON indentation (default: 2)
 * @returns A formatted SARIF v2.1.0 JSON
 * @throws {Error} If the XML content is invalid or cannot be parsed
 *
 * @example
 * ```ts
 * import { convertCheckstyleToSarif } from 'checkstyle-to-sarif'
 *
 * const xml = await fs.readFile('checkstyle.xml', 'utf-8')
 * const sarif = convertCheckstyleToSarif(xml)
 * await fs.writeFile('results.sarif', sarif, 'utf-8')
 * ```
 */
export function convertCheckstyleToSarif(xmlContent: string, indent = 2): string {
  const checkstyle = parseCheckstyleXml(xmlContent);
  const sarif = convertToSarif(checkstyle);
  return JSON.stringify(sarif, null, indent);
}
