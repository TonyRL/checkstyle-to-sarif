/**
 * Root SARIF log object (§3.13)
 */
export interface SarifLog {
  /** MUST be "2.1.0" */
  version: '2.1.0';
  /** Schema URI for SARIF v2.1.0 */
  $schema?: string;
  /** Array of runs */
  runs: Run[];
}

/**
 * Describes a single run of an analysis tool (§3.14)
 */
export interface Run {
  /** Information about the analysis tool (§3.18) */
  tool: Tool;
  /** Array of zero or more result objects (§3.14.23) */
  results: Result[];
  /**
   * Specifies the unit of column measurement (§3.14.17)
   * Must be "utf16CodeUnits" or "unicodeCodePoints"
   */
  columnKind?: 'utf16CodeUnits' | 'unicodeCodePoints';
}

/**
 * Information about the analysis tool (§3.18)
 */
export interface Tool {
  /** The tool component that ran the analysis (§3.19) */
  driver: ToolComponent;
}

/**
 * Represents a component of the analysis tool (§3.19)
 */
export interface ToolComponent {
  /** Tool name (§3.19.8) */
  name: string;
  /** Tool version (§3.19.13) */
  version?: string;
  /** Stable identifier for the rules (§3.19.23) */
  rules?: ReportingDescriptor[];
  /** Informational URI for the tool (§3.19.17) */
  informationUri?: string;
}

/**
 * Metadata that describes a rule (§3.49)
 */
export interface ReportingDescriptor {
  /** Stable rule identifier (§3.49.3) */
  id: string;
  /** Rule name (§3.49.7) */
  name?: string;
  /** Short description of the rule (§3.49.9) */
  shortDescription?: MultiformatMessageString;
  /** Full description of the rule (§3.49.10) */
  fullDescription?: MultiformatMessageString;
  /** Default configuration for this rule (§3.49.14) */
  defaultConfiguration?: ReportingConfiguration;
  /** URI to documentation for this rule */
  helpUri?: string;
}

/**
 * Default configuration for a rule (§3.50)
 */
export interface ReportingConfiguration {
  level?: ResultLevel;
}

/**
 * A message in multiple formats (§3.12)
 */
export interface MultiformatMessageString {
  text: string;
  markdown?: string;
}

/**
 * Represents a single analysis result (§3.27)
 */
export interface Result {
  /** Identifier for the rule that was evaluated (§3.27.5) */
  ruleId?: string;
  /** Index into tool.driver.rules (§3.27.6) */
  ruleIndex?: number;
  /** Reference to the rule (§3.27.7) */
  rule?: ReportingDescriptorReference;
  /** Result level (§3.27.10) */
  level?: ResultLevel;
  /** A message describing the result (§3.27.11) */
  message: Message;
  /** Set of locations where the result was detected (§3.27.12) */
  locations?: Location[];
}

/**
 * A reference to a reporting descriptor (§3.52)
 */
export interface ReportingDescriptorReference {
  id?: string;
  index?: number;
  toolComponent?: ToolComponentReference;
}

/**
 * A reference to a tool component (§3.54)
 */
export interface ToolComponentReference {
  name?: string;
  index?: number;
  guid?: string;
}

/**
 * Encapsulates a message (§3.11)
 */
export interface Message {
  /** A plain text message string (§3.11.8) */
  text?: string;
  /** A markdown message string (§3.11.9) */
  markdown?: string;
  /** Identifier for a message string in the rule metadata (§3.11.10) */
  id?: string;
}

/**
 * A location within a programming artifact (§3.28)
 */
export interface Location {
  /** Unique location identifier within the result (§3.28.2) */
  id?: number;
  /** Physical location (§3.28.3) */
  physicalLocation?: PhysicalLocation;
  /** Logical locations (§3.28.4) */
  logicalLocations?: LogicalLocation[];
}

/**
 * A physical location relevant to a result (§3.29)
 */
export interface PhysicalLocation {
  /** Location of the artifact (§3.29.3) */
  artifactLocation?: ArtifactLocation;
  /** Region within the artifact (§3.29.4) */
  region?: Region;
  /** Larger context region for display (§3.29.5) */
  contextRegion?: Region;
}

/**
 * Location of an artifact (§3.4)
 */
export interface ArtifactLocation {
  /** URI, relative or absolute (§3.4.3) */
  uri?: string;
  /** Base URI identifier (§3.4.4) */
  uriBaseId?: string;
  /** Index into run.artifacts (§3.4.5) */
  index?: number;
}

/**
 * A region in a text or binary artifact (§3.30)
 */
export interface Region {
  /** 1-based starting line number (§3.30.5) */
  startLine?: number;
  /** 1-based starting column number (§3.30.6) */
  startColumn?: number;
  /** 1-based ending line number (§3.30.7) */
  endLine?: number;
  /** 1-based ending column number (§3.30.8) */
  endColumn?: number;
  /** Offset in characters from start of artifact (§3.30.3) */
  charOffset?: number;
  /** Length in characters (§3.30.4) */
  charLength?: number;
}

/**
 * A logical location (§3.33)
 */
export interface LogicalLocation {
  /** Name in description (§3.33.4) */
  name?: string;
  /** Fully qualified name (§3.33.5) */
  fullyQualifiedName?: string;
  /** Type of logical location (§3.33.8) */
  kind?: string;
}

/** Severity level for a result (§3.27.10) */
export type ResultLevel = 'error' | 'warning' | 'note' | 'none';
