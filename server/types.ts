// Node status type
export type NodeStatus = 'idle' | 'pending' | 'running' | 'completed' | 'error';

// Base node data
export interface BaseNodeData {
  label: string;
  description?: string;
  status: NodeStatus;
  progress?: number;
  error?: string;
  [key: string]: unknown;
}

// Node types
export type InputType = 'text' | 'file' | 'select' | 'multi';
export type AgentRole = 'researcher' | 'writer' | 'analyst' | 'coder' | 'custom';
export type SkillType = 'official' | 'custom';
export type McpServerType = 'stdio' | 'sse' | 'http';
export type OutputType = 'markdown' | 'document' | 'image' | 'webpage' | 'link' | 'auto';

export interface InputNodeData extends BaseNodeData {
  inputType: InputType;
  value?: string;
  placeholder?: string;
  options?: string[];
  fileTypes?: string[];
}

export interface SubagentNodeData extends BaseNodeData {
  role: AgentRole;
  tools: string[];
  mdContent?: string;
  systemPrompt?: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  usedInputs?: string[];
}

export interface SkillNodeData extends BaseNodeData {
  skillType: SkillType;
  skillId?: string;
  skillCategory?: string;
  mdContent?: string;
  usedInputs?: string[];
}

export interface McpNodeData extends BaseNodeData {
  serverType: McpServerType;
  serverName: string;
  serverConfig: {
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
  };
  usedInputs?: string[];
}

export interface OutputNodeData extends BaseNodeData {
  outputType: OutputType;
  layoutType?: 'manual' | 'auto' | 'google-docs' | 'google-slides' | 'google-sheets';
  result?: string;
  filePath?: string;
  usedInputs?: string[];
}

export type WorkflowNodeData =
  | InputNodeData
  | SubagentNodeData
  | SkillNodeData
  | McpNodeData
  | OutputNodeData;

// Node structure for execution
export interface ExecutionNode {
  id: string;
  type: 'input' | 'subagent' | 'skill' | 'mcp' | 'output';
  data: WorkflowNodeData;
  position: { x: number; y: number };
}

// Workflow execution request
export interface WorkflowExecutionRequest {
  workflowId: string;
  workflowName: string;
  nodes: ExecutionNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
  inputs?: Record<string, string>;
}

// Node execution update
export interface NodeExecutionUpdate {
  nodeId: string;
  status: NodeStatus;
  progress?: number;
  result?: string;
  error?: string;
}

// Console log entry
export interface ConsoleLogEntry {
  type: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  nodeId?: string;
}
