/**
 * Represents the root Checkstyle XML report
 */
export interface CheckstyleReport {
  /** Checkstyle version */
  version?: string;
  /** Files with violations */
  file: CheckstyleFile[];
}

/**
 * Represents a file element in the Checkstyle report
 */
export interface CheckstyleFile {
  /** Absolute or relative path to the file */
  name: string;
  /** List of errors/violations found in this file */
  error: CheckstyleError[];
}

/**
 * Represents an individual violation/error element
 */
export interface CheckstyleError {
  /** 1-based line number where the violation occurs */
  line: number;
  /** 1-based column number where the violation occurs */
  column?: number;
  /** Severity of the violation */
  severity: CheckstyleSeverity;
  /** Human-readable description of the violation */
  message: string;
  /** Fully qualified class name of the check that reported the violation */
  source: string;
}

export type CheckstyleSeverity = 'error' | 'warning' | 'info' | 'ignore';
