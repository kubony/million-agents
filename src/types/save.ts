// Save/Export type definitions for Claude Code configuration files

export interface McpServerConfig {
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface SkillConfig {
  name: string;
  path: string;  // .claude/skills/[name]/SKILL.md
  content: string;
}

export interface CommandConfig {
  name: string;
  path: string;  // .claude/commands/[name].md
  content: string;
}

export interface AgentConfig {
  name: string;
  path: string;  // .claude/agents/[name].md
  content: string;
}

export interface McpSettingsUpdate {
  mcpServers: Record<string, McpServerConfig>;
}

export interface ClaudeConfigExport {
  skills: SkillConfig[];
  commands: CommandConfig[];
  agents: AgentConfig[];
  mcpSettings: McpSettingsUpdate | null;
}

export interface SaveItemResult {
  name: string;
  path: string;
  success: boolean;
  error?: string;
}

export interface SaveResult {
  success: boolean;
  skills: SaveItemResult[];
  commands: SaveItemResult[];
  agents: SaveItemResult[];
  mcpSettings: { success: boolean; error?: string } | null;
  errors: { type: string; name: string; error: string }[];
}

export type SaveLocation = 'local' | 'global';

export interface SaveOptions {
  location: SaveLocation;
  includeSkills: boolean;
  includeCommands: boolean;
  includeAgents: boolean;
  includeMcpSettings: boolean;
}
