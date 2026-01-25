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
  defaultValue?: string; // AI가 생성한 기본값
  placeholder?: string;
  options?: string[]; // For select type
  fileTypes?: string[]; // For file type
  [key: string]: unknown;
}

// Agent node (Generate in Opal terms)
export type AgentRole = 'researcher' | 'writer' | 'analyst' | 'coder' | 'custom';

export interface AgentNodeData extends BaseNodeData {
  role: AgentRole;
  tools: string[];
  mdContent?: string;
  systemPrompt?: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  usedInputs?: string[]; // IDs of input nodes used
  [key: string]: unknown;
}

// Skill node
export type SkillType = 'official' | 'custom' | 'generated';

export interface SkillNodeData extends BaseNodeData {
  skillType: SkillType;
  skillId?: string;
  skillCategory?: string;
  skillPath?: string; // 생성된 스킬의 파일 경로
  mdContent?: string;
  skillContent?: string; // AI가 생성한 커스텀 스킬 SKILL.md 내용
  usedInputs?: string[];
  [key: string]: unknown;
}

// Hook node
export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop';

export interface HookNodeData extends BaseNodeData {
  hookEvent?: HookEvent;
  hookMatcher?: string;
  hookCommand?: string;
  mdContent?: string;
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
  | AgentNodeData
  | SkillNodeData
  | HookNodeData
  | OutputNodeData;

// Typed nodes
export type InputNode = Node<InputNodeData, 'input'>;
export type AgentNode = Node<AgentNodeData, 'agent'>;
export type SkillNode = Node<SkillNodeData, 'skill'>;
export type HookNode = Node<HookNodeData, 'hook'>;
export type OutputNode = Node<OutputNodeData, 'output'>;

export type WorkflowNode = InputNode | AgentNode | SkillNode | HookNode | OutputNode;
export type WorkflowEdge = Edge;

// Node type enum for type guards
export const NODE_TYPES = {
  INPUT: 'input',
  AGENT: 'agent',
  SKILL: 'skill',
  HOOK: 'hook',
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

// Legacy type aliases for backward compatibility
/** @deprecated Use AgentNodeData instead */
export type SubagentNodeData = AgentNodeData;
/** @deprecated Use AgentNode instead */
export type SubagentNode = AgentNode;
