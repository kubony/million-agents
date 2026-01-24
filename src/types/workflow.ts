import type { WorkflowNode, WorkflowEdge } from './nodes';

// Workflow definition
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
}

// Execution state
export interface ExecutionState {
  isRunning: boolean;
  currentNodeId: string | null;
  completedNodes: string[];
  failedNodes: string[];
  results: Map<string, any>;
  startTime?: number;
  endTime?: number;
}

// Log entry
export type LogLevel = 'info' | 'warning' | 'error' | 'success' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  nodeId?: string;
  message: string;
  details?: any;
}

// Panel state
export type PanelTab = 'preview' | 'console' | 'step' | 'theme';

export interface PanelState {
  activeTab: PanelTab;
  isCollapsed: boolean;
  width: number;
}

// App settings
export interface AppSettings {
  theme: 'dark' | 'light';
  autoSave: boolean;
  showMinimap: boolean;
  showGrid: boolean;
  animateConnections: boolean;
}

// Export format
export interface WorkflowExport {
  version: string;
  workflow: Workflow;
  exportedAt: string;
}
