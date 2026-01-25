import * as fs from 'fs/promises';
import * as path from 'path';

interface LoadedSkill {
  id: string;
  type: 'skill';
  label: string;
  description: string;
  skillId: string;
  skillPath: string;
}

interface LoadedSubagent {
  id: string;
  type: 'agent';
  label: string;
  description: string;
  tools: string[];
  model?: string;
  skills: string[];
  systemPrompt: string;
}

interface LoadedHook {
  id: string;
  type: 'hook';
  label: string;
  description: string;
  hookEvent: string;
  hookMatcher: string;
  hookCommand: string;
}

export type LoadedNode = LoadedSkill | LoadedSubagent | LoadedHook;

export interface ClaudeConfig {
  skills: LoadedSkill[];
  agents: LoadedSubagent[];
  hooks: LoadedHook[];
}

export class ConfigLoaderService {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.env.MAKECC_PROJECT_PATH || process.cwd();
  }

  /**
   * .claude/ 디렉토리에서 모든 설정 로드
   */
  async loadAll(): Promise<ClaudeConfig> {
    const [skills, agents, hooks] = await Promise.all([
      this.loadSkills(),
      this.loadAgents(),
      this.loadHooks(),
    ]);

    return { skills, agents, hooks };
  }

  /**
   * .claude/skills/ 에서 스킬 로드
   */
  async loadSkills(): Promise<LoadedSkill[]> {
    const skillsDir = path.join(this.projectRoot, '.claude', 'skills');
    const skills: LoadedSkill[] = [];

    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
          try {
            const content = await fs.readFile(skillMdPath, 'utf-8');
            const parsed = this.parseFrontmatter(content);

            skills.push({
              id: `skill-${entry.name}`,
              type: 'skill',
              label: parsed.frontmatter.name || entry.name,
              description: parsed.frontmatter.description || '',
              skillId: entry.name,
              skillPath: path.join(skillsDir, entry.name),
            });
          } catch {
            // SKILL.md가 없거나 읽을 수 없으면 스킵
          }
        }
      }
    } catch {
      // skills 디렉토리가 없으면 빈 배열 반환
    }

    return skills;
  }

  /**
   * .claude/agents/ 에서 에이전트 로드
   */
  async loadAgents(): Promise<LoadedSubagent[]> {
    const agentsDir = path.join(this.projectRoot, '.claude', 'agents');
    const agents: LoadedSubagent[] = [];

    try {
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const agentPath = path.join(agentsDir, entry.name);
          try {
            const content = await fs.readFile(agentPath, 'utf-8');
            const parsed = this.parseFrontmatter(content);
            const agentName = entry.name.replace('.md', '');

            agents.push({
              id: `agent-${agentName}`,
              type: 'agent',
              label: parsed.frontmatter.name || agentName,
              description: parsed.frontmatter.description || '',
              tools: this.parseList(parsed.frontmatter.tools),
              model: parsed.frontmatter.model,
              skills: this.parseList(parsed.frontmatter.skills),
              systemPrompt: parsed.body,
            });
          } catch {
            // 읽을 수 없으면 스킵
          }
        }
      }
    } catch {
      // agents 디렉토리가 없으면 빈 배열 반환
    }

    return agents;
  }

  /**
   * .claude/settings.json 에서 훅 로드
   */
  async loadHooks(): Promise<LoadedHook[]> {
    const settingsPath = path.join(this.projectRoot, '.claude', 'settings.json');
    const hooks: LoadedHook[] = [];

    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      if (settings.hooks) {
        for (const [event, eventHooks] of Object.entries(settings.hooks)) {
          if (Array.isArray(eventHooks)) {
            for (let i = 0; i < eventHooks.length; i++) {
              const hookConfig = eventHooks[i] as {
                matcher?: string;
                hooks?: Array<{ type: string; command: string }>;
              };

              const command = hookConfig.hooks?.[0]?.command || '';

              hooks.push({
                id: `hook-${event}-${i}`,
                type: 'hook',
                label: `${event} Hook`,
                description: `Matcher: ${hookConfig.matcher || '*'}`,
                hookEvent: event,
                hookMatcher: hookConfig.matcher || '*',
                hookCommand: command,
              });
            }
          }
        }
      }
    } catch {
      // settings.json이 없거나 파싱 에러면 빈 배열 반환
    }

    return hooks;
  }

  // ===== Private Methods =====

  private parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
    const frontmatter: Record<string, string> = {};
    let body = content;

    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (match) {
      const fmContent = match[1];
      body = match[2].trim();

      for (const line of fmContent.split('\n')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();
          frontmatter[key] = value;
        }
      }
    }

    return { frontmatter, body };
  }

  private parseList(value: string | undefined): string[] {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

export const configLoaderService = new ConfigLoaderService();
