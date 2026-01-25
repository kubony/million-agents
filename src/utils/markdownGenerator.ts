import type {
  WorkflowNode,
  WorkflowEdge,
  InputNodeData,
  SubagentNodeData,
  SkillNodeData,
  CommandNodeData,
  HookNodeData,
  OutputNodeData,
} from '../types/nodes';

export interface GeneratedMarkdown {
  agentMd: string;
  skillMd?: string;
  fullContent: string;
}

export function generateWorkflowMarkdown(
  workflowName: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  results?: Map<string, string>
): GeneratedMarkdown {
  const agentMd = generateAgentMd(workflowName, nodes, edges);
  const skillMd = generateSkillMd(nodes);
  const fullContent = generateFullContent(workflowName, nodes, results);

  return {
    agentMd,
    skillMd: skillMd || undefined,
    fullContent,
  };
}

function generateAgentMd(
  workflowName: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string {
  // Build agent frontmatter
  const subagentNodes = nodes.filter((n) => n.type === 'subagent');
  const skillNodes = nodes.filter((n) => n.type === 'skill');
  const commandNodes = nodes.filter((n) => n.type === 'command');
  const hookNodes = nodes.filter((n) => n.type === 'hook');

  // Collect all tools
  const tools = new Set<string>();
  subagentNodes.forEach((node) => {
    const data = node.data as SubagentNodeData;
    data.tools?.forEach((tool) => tools.add(tool));
  });

  // Determine model (use the most powerful one specified)
  let model: 'sonnet' | 'opus' | 'haiku' = 'sonnet';
  subagentNodes.forEach((node) => {
    const data = node.data as SubagentNodeData;
    if (data.model === 'opus') model = 'opus';
    else if (data.model === 'haiku' && model !== 'opus') model = 'haiku';
  });

  // Generate YAML frontmatter
  const frontmatter = [
    '---',
    `name: ${workflowName.toLowerCase().replace(/\s+/g, '-')}`,
    `description: ${workflowName}`,
    `tools: ${Array.from(tools).join(', ') || 'Read, Write, Edit'}`,
    `model: ${model}`,
  ];

  // Add subagents if there are skill nodes
  if (skillNodes.length > 0) {
    const skillNames = skillNodes.map((n) => {
      const data = n.data as SkillNodeData;
      return data.skillId || n.data.label.toLowerCase().replace(/\s+/g, '-');
    });
    frontmatter.push(`subagents:`);
    skillNames.forEach((name) => frontmatter.push(`  - ${name}`));
  }

  // Add commands
  if (commandNodes.length > 0) {
    frontmatter.push(`commands:`);
    commandNodes.forEach((node) => {
      const data = node.data as CommandNodeData;
      frontmatter.push(`  - name: ${data.commandName || node.data.label}`);
    });
  }

  // Add hooks
  if (hookNodes.length > 0) {
    frontmatter.push(`hooks:`);
    hookNodes.forEach((node) => {
      const data = node.data as HookNodeData;
      frontmatter.push(`  - event: ${data.hookEvent || 'PreToolUse'}`);
      if (data.hookMatcher) {
        frontmatter.push(`    matcher: ${data.hookMatcher}`);
      }
    });
  }

  frontmatter.push('---');

  // Generate agent instructions
  const instructions: string[] = [];
  instructions.push(`# ${workflowName}`);
  instructions.push('');

  // Add description from input nodes
  const inputNodes = nodes.filter((n) => n.type === 'input');
  if (inputNodes.length > 0) {
    instructions.push('## Inputs');
    instructions.push('');
    inputNodes.forEach((node) => {
      const data = node.data as InputNodeData;
      instructions.push(`- **${data.label}**: ${data.description || data.placeholder || 'User input'}`);
    });
    instructions.push('');
  }

  // Add workflow steps
  instructions.push('## Workflow Steps');
  instructions.push('');

  // Build execution order from edges
  const executionOrder = topologicalSort(nodes, edges);
  let stepNumber = 1;

  executionOrder.forEach((node) => {
    if (node.type === 'input') return; // Skip input nodes as steps

    const stepLine = `${stepNumber}. **${node.data.label}**`;
    instructions.push(stepLine);

    if (node.data.description) {
      instructions.push(`   ${node.data.description}`);
    }

    if (node.type === 'subagent') {
      const data = node.data as SubagentNodeData;
      if (data.systemPrompt) {
        instructions.push(`   - System: ${data.systemPrompt.substring(0, 100)}...`);
      }
    }

    instructions.push('');
    stepNumber++;
  });

  // Add output section
  const outputNodes = nodes.filter((n) => n.type === 'output');
  if (outputNodes.length > 0) {
    instructions.push('## Outputs');
    instructions.push('');
    outputNodes.forEach((node) => {
      const data = node.data as OutputNodeData;
      instructions.push(`- **${data.label}**: ${data.outputType} format`);
    });
  }

  return frontmatter.join('\n') + '\n\n' + instructions.join('\n');
}

function generateSkillMd(nodes: WorkflowNode[]): string | null {
  const skillNodes = nodes.filter((n) => n.type === 'skill');
  if (skillNodes.length === 0) return null;

  const skills: string[] = [];

  skillNodes.forEach((node) => {
    const data = node.data as SkillNodeData;

    skills.push('---');
    skills.push(`name: ${data.skillId || data.label.toLowerCase().replace(/\s+/g, '-')}`);
    skills.push(`description: ${data.description || data.label}`);
    skills.push('---');
    skills.push('');
    skills.push(`# ${data.label}`);
    skills.push('');

    if (data.mdContent) {
      skills.push(data.mdContent);
    } else {
      skills.push(`Execute the ${data.label} skill.`);
    }

    skills.push('');
    skills.push('---');
    skills.push('');
  });

  return skills.join('\n');
}

function generateFullContent(
  workflowName: string,
  nodes: WorkflowNode[],
  results?: Map<string, string>
): string {
  if (!results || results.size === 0) {
    return `# ${workflowName}\n\nNo execution results yet. Run the workflow to see results.`;
  }

  const content: string[] = [];
  content.push(`# ${workflowName} - Execution Results`);
  content.push('');
  content.push(`*Generated at ${new Date().toLocaleString()}*`);
  content.push('');

  nodes.forEach((node) => {
    const result = results.get(node.id);
    if (result) {
      content.push(`## ${node.data.label}`);
      content.push('');
      content.push(result);
      content.push('');
      content.push('---');
      content.push('');
    }
  });

  return content.join('\n');
}

// Helper function for topological sort
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
