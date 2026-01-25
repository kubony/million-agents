import type { WorkflowNode, SkillNodeData, SubagentNodeData, CommandNodeData, HookNodeData } from '../types/nodes';

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
  type: 'subagent';
  label: string;
  description: string;
  tools: string[];
  model?: string;
  skills: string[];
  systemPrompt: string;
}

interface LoadedCommand {
  id: string;
  type: 'command';
  label: string;
  description: string;
  commandName: string;
  commandContent: string;
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

interface ClaudeConfig {
  skills: LoadedSkill[];
  subagents: LoadedSubagent[];
  commands: LoadedCommand[];
  hooks: LoadedHook[];
}

/**
 * .claude/ 디렉토리에서 기존 설정 로드
 */
export async function loadClaudeConfig(): Promise<WorkflowNode[]> {
  try {
    const response = await fetch('/api/load/claude-config');
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.statusText}`);
    }

    const config: ClaudeConfig = await response.json();
    return convertToNodes(config);
  } catch (error) {
    console.error('Failed to load Claude config:', error);
    return [];
  }
}

/**
 * 로드된 설정을 노드로 변환
 */
function convertToNodes(config: ClaudeConfig): WorkflowNode[] {
  const nodes: WorkflowNode[] = [];
  let xOffset = 0;
  const xGap = 280;
  const yBase = 150;

  // 스킬 노드
  for (const skill of config.skills) {
    nodes.push({
      id: skill.id,
      type: 'skill',
      position: { x: 100 + xOffset, y: yBase },
      data: {
        label: skill.label,
        description: skill.description,
        status: 'idle',
        skillType: 'custom',
        skillId: skill.skillId,
        skillPath: skill.skillPath,
      } as SkillNodeData,
    });
    xOffset += xGap;
  }

  // 서브에이전트 노드
  for (const agent of config.subagents) {
    nodes.push({
      id: agent.id,
      type: 'subagent',
      position: { x: 100 + xOffset, y: yBase },
      data: {
        label: agent.label,
        description: agent.description,
        role: 'custom',
        tools: agent.tools,
        model: agent.model as SubagentNodeData['model'],
        skills: agent.skills,
        systemPrompt: agent.systemPrompt,
        status: 'idle',
        usedInputs: [],
      } as SubagentNodeData,
    });
    xOffset += xGap;
  }

  // 커맨드 노드
  for (const command of config.commands) {
    nodes.push({
      id: command.id,
      type: 'command',
      position: { x: 100 + xOffset, y: yBase },
      data: {
        label: command.label,
        description: command.description,
        commandName: command.commandName,
        commandContent: command.commandContent,
        status: 'idle',
        usedInputs: [],
      } as CommandNodeData,
    });
    xOffset += xGap;
  }

  // 훅 노드
  for (const hook of config.hooks) {
    nodes.push({
      id: hook.id,
      type: 'hook',
      position: { x: 100 + xOffset, y: yBase },
      data: {
        label: hook.label,
        description: hook.description,
        hookEvent: hook.hookEvent as HookNodeData['hookEvent'],
        hookMatcher: hook.hookMatcher,
        hookCommand: hook.hookCommand,
        status: 'idle',
        usedInputs: [],
      } as HookNodeData,
    });
    xOffset += xGap;
  }

  return nodes;
}
