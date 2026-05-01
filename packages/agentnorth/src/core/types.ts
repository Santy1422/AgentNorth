/** Core domain types for AgentNorth */

export interface FileRef {
  path: string;
  summary: string;
  exports: string[];
  loc: number;
}

export interface TableDef {
  name: string;
  columns: { name: string; type: string; nullable?: boolean }[];
}

export interface ContextBundle {
  module: string;
  files: FileRef[];
  schema: {
    tables: TableDef[];
    mermaid: string;
  };
  dependencies: {
    internal: string[];
    external: string[];
  };
  decisions: Decision[];
  recent_changes: RecentChange[];
  conventions: string[];
  warnings: string[];
}

export interface Decision {
  id: string;
  date: string;
  author: string;
  module: string;
  title: string;
  context: string;
  decision: string;
  status: "active" | "superseded" | "deprecated";
}

export interface RecentChange {
  commit: string;
  date: string;
  author: string;
  summary: string;
  files_changed: string[];
}

export interface ModuleConfig {
  paths: string[];
  description?: string;
  schema_source?: string;
  depends_on?: string[];
}

export interface EnforcementConfig {
  level: "soft" | "strict" | "audit";
  track_sessions: boolean;
  require_log_change: boolean;
  require_log_decision: boolean;
}

export interface AgentNorthConfig {
  version: number;
  project: {
    name: string;
    framework?: string;
  };
  modules: Record<string, ModuleConfig>;
  ignore?: string[];
  conventions?: Record<string, string>;
  enforcement?: EnforcementConfig;
}
