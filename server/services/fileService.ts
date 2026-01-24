import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Type definitions for save operations
export interface McpServerConfig {
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface SkillConfig {
  name: string;
  path: string;
  content: string;
}

export interface CommandConfig {
  name: string;
  path: string;
  content: string;
}

export interface AgentConfig {
  name: string;
  path: string;
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

export type SaveLocation = 'local' | 'global';

export interface SaveOptions {
  location: SaveLocation;
  includeSkills: boolean;
  includeCommands: boolean;
  includeAgents: boolean;
  includeMcpSettings: boolean;
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

export class FileService {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Resolves a path, expanding ~ to home directory
   */
  private resolvePath(filePath: string): string {
    if (filePath.startsWith('~')) {
      return path.join(os.homedir(), filePath.slice(1));
    }
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.projectRoot, filePath);
  }

  /**
   * Ensures a directory exists
   */
  private async ensureDir(dirPath: string): Promise<void> {
    const resolvedPath = this.resolvePath(dirPath);
    await fs.mkdir(resolvedPath, { recursive: true });
  }

  /**
   * Writes content to a file, creating directories as needed
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    const resolvedPath = this.resolvePath(filePath);
    const dirPath = path.dirname(resolvedPath);
    await this.ensureDir(dirPath);
    await fs.writeFile(resolvedPath, content, 'utf-8');
  }

  /**
   * Saves a skill configuration
   */
  async saveSkill(config: SkillConfig): Promise<SaveItemResult> {
    try {
      await this.writeFile(config.path, config.content);
      return { name: config.name, path: config.path, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { name: config.name, path: config.path, success: false, error: errorMessage };
    }
  }

  /**
   * Saves a command configuration
   */
  async saveCommand(config: CommandConfig): Promise<SaveItemResult> {
    try {
      await this.writeFile(config.path, config.content);
      return { name: config.name, path: config.path, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { name: config.name, path: config.path, success: false, error: errorMessage };
    }
  }

  /**
   * Saves an agent configuration
   */
  async saveAgent(config: AgentConfig): Promise<SaveItemResult> {
    try {
      await this.writeFile(config.path, config.content);
      return { name: config.name, path: config.path, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { name: config.name, path: config.path, success: false, error: errorMessage };
    }
  }

  /**
   * Updates MCP settings in settings.local.json
   */
  async updateMcpSettings(
    settings: McpSettingsUpdate,
    location: SaveLocation
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const settingsPath = location === 'global'
        ? '~/.claude/settings.local.json'
        : '.claude/settings.local.json';

      const resolvedPath = this.resolvePath(settingsPath);

      // Read existing settings if they exist
      let existingSettings: Record<string, unknown> = {};
      try {
        const content = await fs.readFile(resolvedPath, 'utf-8');
        existingSettings = JSON.parse(content);
      } catch {
        // File doesn't exist or is invalid, start fresh
      }

      // Merge MCP servers
      const existingMcpServers = (existingSettings.mcpServers as Record<string, unknown>) || {};
      const mergedSettings = {
        ...existingSettings,
        mcpServers: {
          ...existingMcpServers,
          ...settings.mcpServers,
        },
      };

      // Write updated settings
      const dirPath = path.dirname(resolvedPath);
      await this.ensureDir(dirPath);
      await fs.writeFile(resolvedPath, JSON.stringify(mergedSettings, null, 2), 'utf-8');

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Saves an entire workflow configuration
   */
  async saveWorkflow(config: ClaudeConfigExport, options: SaveOptions): Promise<SaveResult> {
    const result: SaveResult = {
      success: true,
      skills: [],
      commands: [],
      agents: [],
      mcpSettings: null,
      errors: [],
    };

    // Save skills
    if (options.includeSkills) {
      for (const skill of config.skills) {
        const skillResult = await this.saveSkill(skill);
        result.skills.push(skillResult);
        if (!skillResult.success) {
          result.success = false;
          result.errors.push({
            type: 'skill',
            name: skill.name,
            error: skillResult.error || 'Unknown error',
          });
        }
      }
    }

    // Save commands
    if (options.includeCommands) {
      for (const command of config.commands) {
        const commandResult = await this.saveCommand(command);
        result.commands.push(commandResult);
        if (!commandResult.success) {
          result.success = false;
          result.errors.push({
            type: 'command',
            name: command.name,
            error: commandResult.error || 'Unknown error',
          });
        }
      }
    }

    // Save agents
    if (options.includeAgents) {
      for (const agent of config.agents) {
        const agentResult = await this.saveAgent(agent);
        result.agents.push(agentResult);
        if (!agentResult.success) {
          result.success = false;
          result.errors.push({
            type: 'agent',
            name: agent.name,
            error: agentResult.error || 'Unknown error',
          });
        }
      }
    }

    // Update MCP settings
    if (options.includeMcpSettings && config.mcpSettings) {
      const mcpResult = await this.updateMcpSettings(config.mcpSettings, options.location);
      result.mcpSettings = mcpResult;
      if (!mcpResult.success) {
        result.success = false;
        result.errors.push({
          type: 'mcp',
          name: 'settings.local.json',
          error: mcpResult.error || 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Gets the project root path
   */
  getProjectPath(): string {
    return this.projectRoot;
  }
}

export const fileService = new FileService();
