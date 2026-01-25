import Anthropic from '@anthropic-ai/sdk';
import type {
  ExecutionNode,
  SubagentNodeData,
  SkillNodeData,
  InputNodeData,
  OutputNodeData,
  McpNodeData,
} from '../types';

type ModelId = 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514' | 'claude-3-5-haiku-20241022';

export class ClaudeService {
  private client: Anthropic;
  private abortController: AbortController | null = null;
  private executionResults: Map<string, string> = new Map();

  constructor() {
    this.client = new Anthropic();
  }

  private getModelId(model?: 'sonnet' | 'opus' | 'haiku'): ModelId {
    switch (model) {
      case 'opus':
        return 'claude-opus-4-20250514';
      case 'haiku':
        return 'claude-3-5-haiku-20241022';
      default:
        return 'claude-sonnet-4-20250514';
    }
  }

  async executeNode(
    node: ExecutionNode,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    this.abortController = new AbortController();

    switch (node.type) {
      case 'input':
        return this.executeInputNode(node.id, node.data as InputNodeData);

      case 'agent':
        return this.executeSubagentNode(
          node.id,
          node.data as SubagentNodeData,
          onProgress
        );

      case 'skill':
        return this.executeSkillNode(node.id, node.data as SkillNodeData);

      case 'mcp':
        return this.executeMcpNode(node.id, node.data as McpNodeData);

      case 'output':
        return this.executeOutputNode(node.id, node.data as OutputNodeData);

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  private async executeInputNode(
    nodeId: string,
    data: InputNodeData
  ): Promise<string> {
    const result = data.value || '';
    this.executionResults.set(nodeId, result);
    return result;
  }

  private async executeSubagentNode(
    nodeId: string,
    data: SubagentNodeData,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    onProgress?.(10);

    // Build context from used inputs
    let context = '';
    if (data.usedInputs && data.usedInputs.length > 0) {
      const inputs = data.usedInputs
        .map((inputId) => this.executionResults.get(inputId))
        .filter(Boolean)
        .join('\n\n');
      context = `Context from previous steps:\n${inputs}\n\n`;
    }

    // Build system prompt based on role
    let systemPrompt = data.systemPrompt || this.getDefaultSystemPrompt(data.role);

    // Add tool instructions if tools are specified
    if (data.tools && data.tools.length > 0) {
      systemPrompt += `\n\nYou have access to the following tools: ${data.tools.join(', ')}`;
    }

    onProgress?.(30);

    try {
      const response = await this.client.messages.create({
        model: this.getModelId(data.model),
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `${context}${data.description || 'Please complete the assigned task.'}`,
          },
        ],
      });

      onProgress?.(80);

      // Extract text from response
      const result = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('\n');

      this.executionResults.set(nodeId, result);
      onProgress?.(100);

      return result;
    } catch (error) {
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeSkillNode(
    nodeId: string,
    data: SkillNodeData
  ): Promise<string> {
    // Build context from used inputs
    let context = '';
    if (data.usedInputs && data.usedInputs.length > 0) {
      const inputs = data.usedInputs
        .map((inputId) => this.executionResults.get(inputId))
        .filter(Boolean)
        .join('\n\n');
      context = inputs;
    }

    // For now, return the skill configuration as result
    // In a full implementation, this would execute the skill's SKILL.md
    const result = data.mdContent
      ? `Skill executed with content:\n${data.mdContent}\n\nContext: ${context}`
      : `Skill ${data.skillId || 'custom'} executed with context: ${context}`;

    this.executionResults.set(nodeId, result);
    return result;
  }

  private async executeMcpNode(
    nodeId: string,
    data: McpNodeData
  ): Promise<string> {
    // MCP server integration would go here
    // For now, return a placeholder result
    const result = `MCP Server ${data.serverName} (${data.serverType}) connection established`;
    this.executionResults.set(nodeId, result);
    return result;
  }

  private async executeOutputNode(
    nodeId: string,
    data: OutputNodeData
  ): Promise<string> {
    // Collect all results from used inputs
    let combinedResult = '';
    if (data.usedInputs && data.usedInputs.length > 0) {
      const inputs = data.usedInputs
        .map((inputId) => this.executionResults.get(inputId))
        .filter(Boolean);
      combinedResult = inputs.join('\n\n---\n\n');
    }

    // Format based on output type
    let formattedResult: string;
    switch (data.outputType) {
      case 'markdown':
        formattedResult = combinedResult;
        break;
      case 'document':
        formattedResult = `# Document Output\n\n${combinedResult}`;
        break;
      default:
        formattedResult = combinedResult;
    }

    this.executionResults.set(nodeId, formattedResult);
    return formattedResult;
  }

  private getDefaultSystemPrompt(role: string): string {
    const prompts: Record<string, string> = {
      researcher:
        'You are an expert researcher. Your task is to gather, analyze, and synthesize information on the given topic. Provide comprehensive, well-structured findings with citations where applicable.',
      writer:
        'You are a professional writer. Your task is to create clear, engaging, and well-structured content. Focus on readability and appropriate tone for the target audience.',
      analyst:
        'You are a data analyst. Your task is to analyze information, identify patterns, and provide insights. Present your findings in a clear, actionable format.',
      coder:
        'You are an expert software developer. Your task is to write clean, efficient, and well-documented code. Follow best practices and consider edge cases.',
      custom:
        'You are a helpful AI assistant. Complete the assigned task to the best of your ability.',
    };

    return prompts[role] || prompts.custom;
  }

  cancelExecution(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  clearResults(): void {
    this.executionResults.clear();
  }
}
