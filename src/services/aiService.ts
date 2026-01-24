import Anthropic from '@anthropic-ai/sdk';
import type { WorkflowNode } from '../types/nodes';
import type { Edge } from '@xyflow/react';

// API key management
let apiKey: string | null = null;

export function setApiKey(key: string) {
  apiKey = key;
  localStorage.setItem('claude_api_key', key);
}

export function getApiKey(): string | null {
  // First check cached key
  if (apiKey) {
    return apiKey;
  }

  // Then check environment variable (Vite)
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (envKey) {
    apiKey = envKey;
    return apiKey;
  }

  // Finally check localStorage
  apiKey = localStorage.getItem('claude_api_key');
  return apiKey;
}

export function clearApiKey() {
  apiKey = null;
  localStorage.removeItem('claude_api_key');
}

// Workflow generation types
export interface WorkflowGenerationResult {
  nodes: WorkflowNode[];
  edges: Edge[];
  description: string;
}

// System prompt for workflow generation
const WORKFLOW_GENERATION_PROMPT = `You are an AI workflow designer. Given a user's request, generate a workflow structure using the following node types:

1. **input** - User input nodes (text, file, or select). Always starts the workflow.
2. **subagent** - AI agent nodes that perform tasks using tools like WebSearch, WebFetch, Read, Write, etc.
3. **skill** - Specialized skill nodes for specific tasks
4. **mcp** - MCP server integration nodes for external services
5. **output** - Output nodes that display results. Always ends the workflow.

Respond with a JSON object containing:
- nodes: Array of node objects with id, type, position, and data
- edges: Array of edge objects connecting nodes (source -> target)
- description: Brief description of the workflow

Node data structure:
- input: { label, description, inputType: "text"|"file"|"select", placeholder }
- subagent: { label, description, role, tools: string[], model: "sonnet"|"opus"|"haiku", systemPrompt }
- skill: { label, description, skillId, category }
- mcp: { label, description, serverName, serverType }
- output: { label, description, outputType: "auto"|"manual" }

Generate positions in a left-to-right flow layout. Start x at 100, increment by 300 for each step. Y positions around 200.`;

// Generate workflow from natural language prompt
export async function generateWorkflow(prompt: string): Promise<WorkflowGenerationResult> {
  const key = getApiKey();
  if (!key) {
    throw new Error('API key not set. Please configure your Claude API key.');
  }

  const client = new Anthropic({
    apiKey: key,
    dangerouslyAllowBrowser: true,
  });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${WORKFLOW_GENERATION_PROMPT}\n\nUser request: ${prompt}\n\nRespond with valid JSON only, no markdown or explanation.`,
      },
    ],
  });

  // Extract text content
  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON response
  try {
    const parsed = JSON.parse(textContent.text) as {
      nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }>;
      edges: Edge[];
      description: string;
    };

    // Add required fields to nodes and cast properly
    const nodes = parsed.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        status: 'idle' as const,
        usedInputs: [],
      },
    })) as unknown as WorkflowNode[];

    return {
      nodes,
      edges: parsed.edges,
      description: parsed.description,
    };
  } catch {
    throw new Error('Failed to parse workflow response from Claude');
  }
}

// Execute a single subagent node
export async function executeSubagent(
  systemPrompt: string,
  userPrompt: string,
  model: 'sonnet' | 'opus' | 'haiku' = 'sonnet'
): Promise<string> {
  const key = getApiKey();
  if (!key) {
    throw new Error('API key not set. Please configure your Claude API key.');
  }

  const client = new Anthropic({
    apiKey: key,
    dangerouslyAllowBrowser: true,
  });

  const modelMap = {
    sonnet: 'claude-sonnet-4-20250514',
    opus: 'claude-opus-4-20250514',
    haiku: 'claude-3-5-haiku-20241022',
  };

  const message = await client.messages.create({
    model: modelMap[model],
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textContent.text;
}

// Check if API key is configured
export function isConfigured(): boolean {
  return !!getApiKey();
}
