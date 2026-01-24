import type { ClaudeConfigExport, SaveResult, SaveOptions } from '../types/save';

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Saves workflow as Claude Code configuration files
 */
export async function saveWorkflowAsClaudeConfig(
  config: ClaudeConfigExport,
  options: SaveOptions
): Promise<SaveResult> {
  const response = await fetch(`${API_BASE_URL}/save/workflow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      config,
      options,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to save workflow');
  }

  return response.json();
}

/**
 * Gets the current project path
 */
export async function getProjectPath(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/project-path`);

  if (!response.ok) {
    throw new Error('Failed to get project path');
  }

  const data = await response.json();
  return data.path;
}

/**
 * Previews the files that will be created without actually saving
 */
export async function previewSaveFiles(
  config: ClaudeConfigExport,
  options: SaveOptions
): Promise<{ files: Array<{ path: string; content: string; type: string }> }> {
  const files: Array<{ path: string; content: string; type: string }> = [];

  if (options.includeSkills) {
    config.skills.forEach((skill) => {
      files.push({
        path: skill.path,
        content: skill.content,
        type: 'skill',
      });
    });
  }

  if (options.includeCommands) {
    config.commands.forEach((command) => {
      files.push({
        path: command.path,
        content: command.content,
        type: 'command',
      });
    });
  }

  if (options.includeAgents) {
    config.agents.forEach((agent) => {
      files.push({
        path: agent.path,
        content: agent.content,
        type: 'agent',
      });
    });
  }

  if (options.includeMcpSettings && config.mcpSettings) {
    files.push({
      path: options.location === 'global' ? '~/.claude/settings.local.json' : '.claude/settings.local.json',
      content: JSON.stringify(config.mcpSettings, null, 2),
      type: 'mcp',
    });
  }

  return { files };
}
