import type { Node, Edge } from '@xyflow/react';

// Node status
export type NodeStatus = 'idle' | 'pending' | 'running' | 'completed' | 'error';

// Base node data - with index signature for React Flow compatibility
export interface BaseNodeData {
  label: string;
  description?: string;
  status: NodeStatus;
  progress?: number;
  error?: string;
  [key: string]: unknown;
}

// Input node types
export type InputType = 'text' | 'file' | 'select' | 'multi';

export interface InputNodeData extends BaseNodeData {
  inputType: InputType;
  value?: string;
  placeholder?: string;
  options?: string[]; // For select type
  fileTypes?: string[]; // For file type
  [key: string]: unknown;
}

// Subagent node (Generate in Opal terms)
export type AgentRole = 'researcher' | 'writer' | 'analyst' | 'coder' | 'custom';

export interface SubagentNodeData extends BaseNodeData {
  role: AgentRole;
  tools: string[];
  mdContent?: string;
  systemPrompt?: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  usedInputs?: string[]; // IDs of input nodes used
  [key: string]: unknown;
}

// Skill node
export type SkillType = 'official' | 'custom';

export interface SkillNodeData extends BaseNodeData {
  skillType: SkillType;
  skillId?: string;
  skillCategory?: string;
  mdContent?: string;
  usedInputs?: string[];
  [key: string]: unknown;
}

// MCP node
export type McpServerType = 'stdio' | 'sse' | 'http';

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
  [key: string]: unknown;
}

// Output node
export type OutputType = 'markdown' | 'document' | 'image' | 'webpage' | 'link' | 'auto';

export interface OutputNodeData extends BaseNodeData {
  outputType: OutputType;
  layoutType?: 'manual' | 'auto' | 'google-docs' | 'google-slides' | 'google-sheets';
  result?: string;
  filePath?: string;
  usedInputs?: string[];
  [key: string]: unknown;
}

// Node type union
export type WorkflowNodeData =
  | InputNodeData
  | SubagentNodeData
  | SkillNodeData
  | McpNodeData
  | OutputNodeData;

// Typed nodes
export type InputNode = Node<InputNodeData, 'input'>;
export type SubagentNode = Node<SubagentNodeData, 'subagent'>;
export type SkillNode = Node<SkillNodeData, 'skill'>;
export type McpNode = Node<McpNodeData, 'mcp'>;
export type OutputNode = Node<OutputNodeData, 'output'>;

export type WorkflowNode = InputNode | SubagentNode | SkillNode | McpNode | OutputNode;
export type WorkflowEdge = Edge;

// Node type enum for type guards
export const NODE_TYPES = {
  INPUT: 'input',
  SUBAGENT: 'subagent',
  SKILL: 'skill',
  MCP: 'mcp',
  OUTPUT: 'output',
} as const;

export type NodeType = typeof NODE_TYPES[keyof typeof NODE_TYPES];

// Default tools list
export const AVAILABLE_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'Task',
  'TodoWrite',
] as const;

export type AvailableTool = typeof AVAILABLE_TOOLS[number];
