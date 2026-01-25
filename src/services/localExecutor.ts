import type { WorkflowNode, InputNodeData, AgentNodeData, SkillNodeData, HookNodeData, OutputNodeData } from '../types/nodes';
import type { Edge } from '@xyflow/react';
import { executeSubagent, isConfigured } from './aiService';

export interface ExecutionCallbacks {
  onNodeStart: (nodeId: string) => void;
  onNodeProgress: (nodeId: string, progress: number) => void;
  onNodeComplete: (nodeId: string, result: unknown) => void;
  onNodeError: (nodeId: string, error: string) => void;
  onLog: (level: 'info' | 'warning' | 'error' | 'success', message: string, nodeId?: string) => void;
}

export interface ExecutionContext {
  results: Map<string, unknown>;
  cancelled: boolean;
}

// Topological sort for execution order
function topologicalSort(
  nodes: WorkflowNode[],
  edges: Edge[]
): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  nodes.forEach((node) => {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  });

  edges.forEach((edge) => {
    adjList.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  const result: WorkflowNode[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodeMap.get(nodeId);
    if (node) {
      result.push(node);
    }

    adjList.get(nodeId)?.forEach((neighborId) => {
      const newDegree = (inDegree.get(neighborId) || 0) - 1;
      inDegree.set(neighborId, newDegree);
      if (newDegree === 0) {
        queue.push(neighborId);
      }
    });
  }

  return result;
}

// Get inputs for a node based on connected edges
function getNodeInputs(
  nodeId: string,
  edges: Edge[],
  results: Map<string, unknown>
): string {
  const inputEdges = edges.filter((e) => e.target === nodeId);
  const inputs: string[] = [];

  for (const edge of inputEdges) {
    const result = results.get(edge.source);
    if (result !== undefined) {
      inputs.push(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    }
  }

  return inputs.join('\n\n---\n\n');
}

// Execute input node
async function executeInputNode(
  node: WorkflowNode,
  callbacks: ExecutionCallbacks
): Promise<string> {
  const data = node.data as InputNodeData;
  callbacks.onNodeProgress(node.id, 50);

  // Simulate getting user input (in real app, this would wait for user)
  const value = data.value || data.placeholder || 'User input placeholder';

  callbacks.onNodeProgress(node.id, 100);
  callbacks.onLog('info', `Input received: ${value.slice(0, 50)}...`, node.id);

  return value;
}

// Execute agent node
async function executeAgentNode(
  node: WorkflowNode,
  inputText: string,
  callbacks: ExecutionCallbacks
): Promise<string> {
  const data = node.data as AgentNodeData;

  if (!isConfigured()) {
    throw new Error('API key not configured. Please set your Claude API key.');
  }

  callbacks.onNodeProgress(node.id, 20);
  callbacks.onLog('info', `Starting AI agent: ${data.label}`, node.id);

  const systemPrompt = data.systemPrompt || `You are an AI assistant. ${data.description || ''}`;
  const userPrompt = inputText || 'Please help me with the following task.';

  callbacks.onNodeProgress(node.id, 50);

  try {
    const result = await executeSubagent(
      systemPrompt,
      userPrompt,
      data.model || 'sonnet'
    );

    callbacks.onNodeProgress(node.id, 100);
    callbacks.onLog('success', `Agent completed: ${result.slice(0, 100)}...`, node.id);

    return result;
  } catch (error) {
    throw new Error(`Agent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Execute skill node
async function executeSkillNode(
  node: WorkflowNode,
  inputText: string,
  callbacks: ExecutionCallbacks
): Promise<string> {
  const data = node.data as SkillNodeData;

  callbacks.onNodeProgress(node.id, 50);
  callbacks.onLog('info', `Executing skill: ${data.label}`, node.id);

  // Generate skill definition
  const skillDefinition = `# Skill: ${data.label}

Category: ${data.skillCategory || 'general'}
Skill ID: ${data.skillId || 'custom-skill'}

## Description
${data.description || 'Custom skill'}

## Input
${inputText}

## Output
Skill executed successfully with the provided input.`;

  callbacks.onNodeProgress(node.id, 100);
  callbacks.onLog('success', `Skill ${data.label} completed`, node.id);

  return skillDefinition;
}

// Execute Hook node
async function executeHookNode(
  node: WorkflowNode,
  inputText: string,
  callbacks: ExecutionCallbacks
): Promise<string> {
  const data = node.data as HookNodeData;

  callbacks.onNodeProgress(node.id, 50);
  callbacks.onLog('info', `Configuring hook: ${data.hookEvent || 'PreToolUse'}`, node.id);

  // Generate hook configuration
  const hookConfig = `# Hook Configuration

Event: ${data.hookEvent || 'PreToolUse'}
Matcher: ${data.hookMatcher || '*'}
Command: ${data.hookCommand || 'echo "Hook executed"'}

## Input
${inputText}

## Status
Hook configured successfully. In production, this would set up the actual hook.`;

  callbacks.onNodeProgress(node.id, 100);
  callbacks.onLog('success', `Hook ${data.hookEvent || 'unnamed'} configured`, node.id);

  return hookConfig;
}

// Execute output node
async function executeOutputNode(
  node: WorkflowNode,
  inputText: string,
  callbacks: ExecutionCallbacks
): Promise<string> {
  const data = node.data as OutputNodeData;

  callbacks.onNodeProgress(node.id, 50);
  callbacks.onLog('info', `Preparing output: ${data.label}`, node.id);

  const output = `# Workflow Output

## Result
${inputText}

## Output Type
${data.outputType || 'auto'}

## Generated at
${new Date().toISOString()}`;

  callbacks.onNodeProgress(node.id, 100);
  callbacks.onLog('success', 'Workflow completed successfully', node.id);

  return output;
}

// Main execution function
export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: Edge[],
  callbacks: ExecutionCallbacks
): Promise<Map<string, unknown>> {
  const context: ExecutionContext = {
    results: new Map(),
    cancelled: false,
  };

  // Sort nodes by execution order
  const sortedNodes = topologicalSort(nodes, edges);

  callbacks.onLog('info', `Starting workflow execution with ${sortedNodes.length} nodes`);

  for (const node of sortedNodes) {
    if (context.cancelled) {
      callbacks.onLog('warning', 'Workflow execution cancelled');
      break;
    }

    callbacks.onNodeStart(node.id);

    try {
      const inputText = getNodeInputs(node.id, edges, context.results);
      let result: unknown;

      switch (node.type) {
        case 'input':
          result = await executeInputNode(node, callbacks);
          break;
        case 'agent':
          result = await executeAgentNode(node, inputText, callbacks);
          break;
        case 'skill':
          result = await executeSkillNode(node, inputText, callbacks);
          break;
        case 'hook':
          result = await executeHookNode(node, inputText, callbacks);
          break;
        case 'output':
          result = await executeOutputNode(node, inputText, callbacks);
          break;
        default:
          result = inputText;
      }

      context.results.set(node.id, result);
      callbacks.onNodeComplete(node.id, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      callbacks.onNodeError(node.id, errorMessage);
      callbacks.onLog('error', `Node ${node.data.label} failed: ${errorMessage}`, node.id);
      throw error;
    }
  }

  return context.results;
}

// Cancel execution
export function createCancellableExecution() {
  let cancelled = false;

  return {
    cancel: () => {
      cancelled = true;
    },
    isCancelled: () => cancelled,
  };
}
