import Anthropic from '@anthropic-ai/sdk';
import type { ApiSettings } from './workflowAIService';
import { skillGeneratorService } from './skillGeneratorService';

export interface NodeContentRequest {
  nodeType: 'agent' | 'skill' | 'hook';
  nodeLabel: string;
  prompt: string;
  projectPath: string;
}

export interface AgentContent {
  description: string;
  systemPrompt: string;
  tools: string[];
  model: string;
}

export interface SkillContent {
  description: string;
  skillPath: string;
  skillId: string;
  skillType: 'generated';
}

export interface HookContent {
  description: string;
  hookEvent: string;
  hookMatcher: string;
  hookCommand: string;
}

export type NodeContent = AgentContent | SkillContent | HookContent;

const AVAILABLE_TOOLS = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'WebSearch', 'WebFetch', 'Task', 'NotebookEdit',
];

const AGENT_SYSTEM_PROMPT = `You are an expert at creating Claude Code agent configurations.

Given a user's description, generate an optimal agent configuration.

RESPOND WITH ONLY A VALID JSON OBJECT - NO MARKDOWN, NO CODE BLOCKS.

## Available Tools
${AVAILABLE_TOOLS.join(', ')}

## JSON Schema

{
  "description": "Brief description of what this agent does (1-2 sentences)",
  "systemPrompt": "Detailed system prompt that guides the agent's behavior. Be specific about:\n- What the agent should do\n- How it should approach tasks\n- What format to use for outputs\n- Any constraints or guidelines",
  "tools": ["Tool1", "Tool2"],
  "model": "sonnet"
}

## Model Options
- "sonnet": Claude 4 Sonnet - Fast, cost-efficient (recommended for most tasks)
- "opus": Claude 4.5 Opus - Best for complex reasoning tasks
- "haiku": Claude 3.5 Haiku - Fastest, for simple tasks

## Guidelines
- Choose tools based on what the agent needs to accomplish
- If the agent needs to search the web, include WebSearch and WebFetch
- If the agent needs to read/write files, include Read, Write, Edit
- If the agent needs to run commands, include Bash
- System prompt should be comprehensive (100-300 words)
- Write system prompt in Korean if the user's prompt is in Korean`;

const HOOK_SYSTEM_PROMPT = `You are an expert at creating Claude Code hook configurations.

Given a user's description, generate an optimal hook configuration.

RESPOND WITH ONLY A VALID JSON OBJECT - NO MARKDOWN, NO CODE BLOCKS.

## JSON Schema

{
  "description": "Brief description of what this hook does",
  "hookEvent": "PreToolUse",
  "hookMatcher": "Bash",
  "hookCommand": "echo 'Hook triggered'"
}

## Hook Events
- "PreToolUse": Before a tool is used (can modify or block)
- "PostToolUse": After a tool completes (can process results)
- "Notification": When Claude sends a notification
- "Stop": When Claude stops execution

## Guidelines
- hookMatcher is a tool name pattern (e.g., "Bash", "Write", "Edit")
- hookCommand is the shell command to execute
- For PreToolUse, the hook can inspect and optionally block actions
- Common use cases:
  - Linting before file writes
  - Security checks before Bash commands
  - Logging after tool executions
- Write descriptions in Korean if the user's prompt is in Korean`;

class NodeContentService {
  private async getClient(settings: ApiSettings): Promise<Anthropic> {
    if (settings.apiMode === 'direct' && settings.apiKey) {
      return new Anthropic({ apiKey: settings.apiKey });
    } else if (settings.apiMode === 'proxy' && settings.proxyUrl) {
      return new Anthropic({
        baseURL: settings.proxyUrl,
        apiKey: 'dummy-key',
      });
    }
    throw new Error('API 설정이 올바르지 않습니다.');
  }

  async generateAgentContent(
    prompt: string,
    nodeLabel: string,
    settings: ApiSettings
  ): Promise<AgentContent> {
    const client = await this.getClient(settings);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Create an agent configuration for: "${nodeLabel}"

User's description:
${prompt}`,
        },
      ],
      system: AGENT_SYSTEM_PROMPT,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    let result: AgentContent;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      result = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse agent response:', content.text);
      throw new Error('AI 응답을 파싱할 수 없습니다.');
    }

    // Validate tools
    result.tools = (result.tools || []).filter(tool =>
      AVAILABLE_TOOLS.includes(tool)
    );

    // Validate model
    if (!['sonnet', 'opus', 'haiku'].includes(result.model)) {
      result.model = 'sonnet';
    }

    return result;
  }

  async generateSkillContent(
    prompt: string,
    nodeLabel: string,
    projectPath: string,
    settings: ApiSettings
  ): Promise<SkillContent> {
    // Use existing skill generator
    const fullPrompt = `"${nodeLabel}" 스킬을 만들어줘: ${prompt}`;

    const result = await skillGeneratorService.generate(fullPrompt, {
      ...settings,
      projectPath,
    });

    if (!result.success || !result.skill) {
      throw new Error(result.error || '스킬 생성에 실패했습니다.');
    }

    return {
      description: result.skill.description,
      skillPath: result.savedPath || '',
      skillId: result.skill.skillId,
      skillType: 'generated',
    };
  }

  async generateHookContent(
    prompt: string,
    nodeLabel: string,
    settings: ApiSettings
  ): Promise<HookContent> {
    const client = await this.getClient(settings);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Create a hook configuration for: "${nodeLabel}"

User's description:
${prompt}`,
        },
      ],
      system: HOOK_SYSTEM_PROMPT,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    let result: HookContent;
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      result = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse hook response:', content.text);
      throw new Error('AI 응답을 파싱할 수 없습니다.');
    }

    // Validate hook event
    const validEvents = ['PreToolUse', 'PostToolUse', 'Notification', 'Stop'];
    if (!validEvents.includes(result.hookEvent)) {
      result.hookEvent = 'PreToolUse';
    }

    return result;
  }

  async generate(
    request: NodeContentRequest,
    settings: ApiSettings
  ): Promise<NodeContent> {
    const { nodeType, nodeLabel, prompt, projectPath } = request;

    switch (nodeType) {
      case 'agent':
        return this.generateAgentContent(prompt, nodeLabel, settings);
      case 'skill':
        return this.generateSkillContent(prompt, nodeLabel, projectPath, settings);
      case 'hook':
        return this.generateHookContent(prompt, nodeLabel, settings);
      default:
        throw new Error(`지원하지 않는 노드 타입: ${nodeType}`);
    }
  }
}

export const nodeContentService = new NodeContentService();
