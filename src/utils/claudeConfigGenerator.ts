import type { WorkflowNode, WorkflowEdge, SubagentNodeData, SkillNodeData, McpNodeData, InputNodeData, OutputNodeData } from '../types/nodes';
import type { ClaudeConfigExport, SkillConfig, CommandConfig, AgentConfig, McpSettingsUpdate, SaveLocation } from '../types/save';

/**
 * Generates Claude Code configuration files from workflow nodes
 */
export function generateClaudeConfig(
  workflowName: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  location: SaveLocation = 'local'
): ClaudeConfigExport {
  const basePath = location === 'global' ? '~/.claude' : '.claude';

  const skills = generateSkillConfigs(nodes, basePath);
  const agents = generateAgentConfigs(nodes, basePath);
  const commands = generateCommandConfigs(workflowName, nodes, edges, basePath);
  const mcpSettings = generateMcpSettings(nodes);

  return {
    skills,
    commands,
    agents,
    mcpSettings,
  };
}

/**
 * Generates skill configurations from skill nodes
 */
function generateSkillConfigs(nodes: WorkflowNode[], basePath: string): SkillConfig[] {
  const skillNodes = nodes.filter((n): n is WorkflowNode & { data: SkillNodeData } => n.type === 'skill');

  return skillNodes
    .filter((node) => node.data.skillType === 'custom')
    .map((node) => {
      const data = node.data;
      const name = sanitizeName(data.skillId || data.label);
      const path = `${basePath}/skills/${name}/SKILL.md`;
      const content = generateSkillContent(data);

      return { name, path, content };
    });
}

/**
 * Generates agent configurations from subagent nodes
 */
function generateAgentConfigs(nodes: WorkflowNode[], basePath: string): AgentConfig[] {
  const subagentNodes = nodes.filter((n): n is WorkflowNode & { data: SubagentNodeData } => n.type === 'subagent');

  return subagentNodes.map((node) => {
    const data = node.data;
    const name = sanitizeName(data.label);
    const path = `${basePath}/agents/${name}.md`;
    const content = generateAgentContent(data);

    return { name, path, content };
  });
}

/**
 * Generates command configuration from the entire workflow
 */
function generateCommandConfigs(
  workflowName: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  basePath: string
): CommandConfig[] {
  if (nodes.length === 0) return [];

  const name = sanitizeName(workflowName);
  const path = `${basePath}/commands/${name}.md`;
  const content = generateCommandContent(workflowName, nodes, edges);

  return [{ name, path, content }];
}

/**
 * Generates MCP settings from MCP nodes
 */
function generateMcpSettings(nodes: WorkflowNode[]): McpSettingsUpdate | null {
  const mcpNodes = nodes.filter((n): n is WorkflowNode & { data: McpNodeData } => n.type === 'mcp');

  if (mcpNodes.length === 0) return null;

  const mcpServers: McpSettingsUpdate['mcpServers'] = {};

  mcpNodes.forEach((node) => {
    const data = node.data;
    mcpServers[data.serverName] = {
      type: data.serverType,
      command: data.serverConfig.command,
      args: data.serverConfig.args,
      url: data.serverConfig.url,
      env: data.serverConfig.env,
    };
  });

  return { mcpServers };
}

/**
 * Generates SKILL.md content for a skill node
 */
function generateSkillContent(data: SkillNodeData): string {
  const name = sanitizeName(data.skillId || data.label);
  const description = data.description || data.label;

  const lines: string[] = [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    `# ${data.label}`,
    '',
  ];

  if (data.mdContent) {
    lines.push(data.mdContent);
  } else {
    lines.push(`Execute the ${data.label} skill.`);
  }

  return lines.join('\n');
}

/**
 * Generates agent.md content for a subagent node
 */
function generateAgentContent(data: SubagentNodeData): string {
  const name = sanitizeName(data.label);
  const description = data.description || data.label;
  const tools = data.tools.length > 0 ? data.tools.join(', ') : 'Read, Write, Edit';
  const model = data.model || 'sonnet';

  const lines: string[] = [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    `tools: ${tools}`,
    `model: ${model}`,
    '---',
    '',
  ];

  if (data.systemPrompt) {
    lines.push(data.systemPrompt);
  } else if (data.mdContent) {
    lines.push(data.mdContent);
  } else {
    lines.push(`# ${data.label}`);
    lines.push('');
    lines.push(`This agent performs the ${data.role} role.`);
  }

  return lines.join('\n');
}

/**
 * Generates command.md content from the workflow
 */
function generateCommandContent(
  workflowName: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string {
  const inputNodes = nodes.filter((n): n is WorkflowNode & { data: InputNodeData } => n.type === 'input');
  const outputNodes = nodes.filter((n): n is WorkflowNode & { data: OutputNodeData } => n.type === 'output');

  // Build argument hints from input nodes
  const argHints = inputNodes.map((n) => `<${sanitizeName(n.data.label)}>`).join(' ');
  const description = `Workflow: ${workflowName}`;

  const lines: string[] = [
    '---',
    `description: ${description}`,
  ];

  if (argHints) {
    lines.push(`argument-hint: ${argHints}`);
  }

  lines.push('---');
  lines.push('');
  lines.push(`# ${workflowName}`);
  lines.push('');

  // Add input section
  if (inputNodes.length > 0) {
    lines.push('## Inputs');
    lines.push('');
    inputNodes.forEach((node) => {
      const data = node.data;
      lines.push(`- **${data.label}**: ${data.description || data.placeholder || 'User input'}`);
    });
    lines.push('');
  }

  // Add workflow steps
  lines.push('## Workflow Steps');
  lines.push('');

  const executionOrder = topologicalSort(nodes, edges);
  let stepNumber = 1;

  executionOrder.forEach((node) => {
    if (node.type === 'input') return;

    lines.push(`${stepNumber}. **${node.data.label}**`);

    if (node.data.description) {
      lines.push(`   ${node.data.description}`);
    }

    if (node.type === 'subagent') {
      const data = node.data as SubagentNodeData;
      if (data.systemPrompt) {
        lines.push(`   - Prompt: ${data.systemPrompt.substring(0, 100)}${data.systemPrompt.length > 100 ? '...' : ''}`);
      }
      if (data.tools.length > 0) {
        lines.push(`   - Tools: ${data.tools.join(', ')}`);
      }
    }

    if (node.type === 'skill') {
      const data = node.data as SkillNodeData;
      if (data.skillId) {
        lines.push(`   - Invoke skill: ${data.skillId}`);
      }
    }

    if (node.type === 'mcp') {
      const data = node.data as McpNodeData;
      lines.push(`   - MCP Server: ${data.serverName}`);
    }

    lines.push('');
    stepNumber++;
  });

  // Add output section
  if (outputNodes.length > 0) {
    lines.push('## Outputs');
    lines.push('');
    outputNodes.forEach((node) => {
      const data = node.data;
      lines.push(`- **${data.label}**: ${data.outputType} format`);
    });
  }

  return lines.join('\n');
}

/**
 * Sanitizes a name for use as file/directory name
 */
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Topological sort for determining execution order
 */
function topologicalSort<T extends { id: string }>(
  nodes: T[],
  edges: Array<{ source: string; target: string }>
): T[] {
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

  const result: T[] = [];
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

export { sanitizeName };
