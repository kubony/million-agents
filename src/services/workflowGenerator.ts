import { nanoid } from 'nanoid';
import type {
  WorkflowNode,
  WorkflowEdge,
  InputNodeData,
  SubagentNodeData,
  SkillNodeData,
  McpNodeData,
  OutputNodeData,
  AgentRole,
} from '../types/nodes';

export interface GeneratedWorkflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// AI 생성 결과 타입 (서버에서 반환)
interface AIWorkflowResult {
  workflowName: string;
  description: string;
  nodes: AIGeneratedNode[];
  edges: { from: number; to: number }[];
}

interface AIGeneratedNode {
  type: 'input' | 'subagent' | 'skill' | 'mcp' | 'output';
  label: string;
  description: string;
  config: {
    inputType?: 'text' | 'file' | 'select';
    placeholder?: string;
    role?: string;
    tools?: string[];
    model?: string;
    systemPrompt?: string;
    skillType?: 'official' | 'custom';
    skillId?: string;
    skillContent?: string;
    outputType?: 'auto' | 'markdown' | 'document' | 'image';
  };
}

interface WorkflowStep {
  type: 'input' | 'subagent' | 'skill' | 'mcp' | 'output';
  label: string;
  description: string;
  config?: Record<string, unknown>;
}

// Simple keyword-based workflow pattern matching
const WORKFLOW_PATTERNS: Array<{
  keywords: string[];
  steps: WorkflowStep[];
}> = [
  {
    keywords: ['research', 'find', 'search', 'look up', 'investigate'],
    steps: [
      {
        type: 'input',
        label: 'Research Topic',
        description: 'Enter the topic to research',
      },
      {
        type: 'subagent',
        label: 'Research Agent',
        description: 'Conduct comprehensive research on the topic',
        config: { role: 'researcher', tools: ['WebSearch', 'WebFetch', 'Read'] },
      },
      {
        type: 'output',
        label: 'Research Results',
        description: 'Compiled research findings',
        config: { outputType: 'markdown' },
      },
    ],
  },
  {
    keywords: ['write', 'create', 'generate', 'draft', 'compose'],
    steps: [
      {
        type: 'input',
        label: 'Content Brief',
        description: 'Describe what content you want to create',
      },
      {
        type: 'subagent',
        label: 'Content Writer',
        description: 'Create high-quality content based on the brief',
        config: { role: 'writer', tools: ['Read', 'Write'] },
      },
      {
        type: 'output',
        label: 'Written Content',
        description: 'Final written output',
        config: { outputType: 'markdown' },
      },
    ],
  },
  {
    keywords: ['analyze', 'review', 'evaluate', 'assess', 'examine'],
    steps: [
      {
        type: 'input',
        label: 'Analysis Input',
        description: 'Data or content to analyze',
      },
      {
        type: 'subagent',
        label: 'Analysis Agent',
        description: 'Perform detailed analysis',
        config: { role: 'analyst', tools: ['Read', 'Grep', 'Glob'] },
      },
      {
        type: 'output',
        label: 'Analysis Report',
        description: 'Structured analysis findings',
        config: { outputType: 'markdown' },
      },
    ],
  },
  {
    keywords: ['code', 'develop', 'implement', 'build', 'program'],
    steps: [
      {
        type: 'input',
        label: 'Requirements',
        description: 'Describe what you want to build',
      },
      {
        type: 'subagent',
        label: 'Developer Agent',
        description: 'Write code based on requirements',
        config: { role: 'coder', tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'] },
      },
      {
        type: 'output',
        label: 'Generated Code',
        description: 'Implementation output',
        config: { outputType: 'auto' },
      },
    ],
  },
  {
    keywords: ['html', 'webpage', 'website', 'page', 'landing'],
    steps: [
      {
        type: 'input',
        label: 'Page Requirements',
        description: 'Describe the webpage you want',
      },
      {
        type: 'subagent',
        label: 'Web Developer',
        description: 'Create HTML/CSS for the webpage',
        config: { role: 'coder', tools: ['Write'] },
      },
      {
        type: 'skill',
        label: 'Image Generator',
        description: 'Generate images for the page',
        config: { skillType: 'official', skillId: 'image-gen' },
      },
      {
        type: 'output',
        label: 'Complete Webpage',
        description: 'HTML page with images',
        config: { outputType: 'auto' },
      },
    ],
  },
  {
    keywords: ['image', 'picture', 'illustration', 'graphic', 'visual'],
    steps: [
      {
        type: 'input',
        label: 'Image Description',
        description: 'Describe the image you want',
      },
      {
        type: 'skill',
        label: 'Image Generator',
        description: 'Generate image based on description',
        config: { skillType: 'official', skillId: 'image-gen-nanobanana' },
      },
      {
        type: 'output',
        label: 'Generated Image',
        description: 'Final image output',
        config: { outputType: 'auto' },
      },
    ],
  },
  {
    keywords: ['ppt', 'presentation', 'slides', 'powerpoint'],
    steps: [
      {
        type: 'input',
        label: 'Presentation Topic',
        description: 'Topic and outline for presentation',
      },
      {
        type: 'subagent',
        label: 'Content Planner',
        description: 'Plan presentation structure and content',
        config: { role: 'writer', tools: ['Read'] },
      },
      {
        type: 'skill',
        label: 'PPT Generator',
        description: 'Create PowerPoint presentation',
        config: { skillType: 'official', skillId: 'ppt-generator' },
      },
      {
        type: 'output',
        label: 'Presentation',
        description: 'Final PowerPoint file',
        config: { outputType: 'auto' },
      },
    ],
  },
];

// Default workflow for unrecognized prompts
const DEFAULT_STEPS: WorkflowStep[] = [
  {
    type: 'input',
    label: 'User Input',
    description: 'Enter your input',
  },
  {
    type: 'subagent',
    label: 'AI Assistant',
    description: 'Process the input and generate response',
    config: { role: 'custom', tools: ['Read', 'Write'] },
  },
  {
    type: 'output',
    label: 'Output',
    description: 'Final output',
    config: { outputType: 'auto' },
  },
];

function findMatchingPattern(prompt: string): WorkflowStep[] {
  const lowerPrompt = prompt.toLowerCase();

  for (const pattern of WORKFLOW_PATTERNS) {
    if (pattern.keywords.some((keyword) => lowerPrompt.includes(keyword))) {
      return pattern.steps;
    }
  }

  return DEFAULT_STEPS;
}

function createNodeFromStep(
  step: WorkflowStep,
  index: number,
  _totalSteps: number,
  previousNodeIds: string[]
): WorkflowNode {
  const id = nanoid();
  const xSpacing = 300;
  const startX = 100;
  const centerY = 200;

  const position = {
    x: startX + index * xSpacing,
    y: centerY,
  };

  const baseData = {
    label: step.label,
    description: step.description,
    status: 'idle' as const,
    usedInputs: index > 0 ? previousNodeIds : [],
  };

  switch (step.type) {
    case 'input':
      return {
        id,
        type: 'input',
        position,
        data: {
          ...baseData,
          inputType: 'text',
          placeholder: step.description,
        } as InputNodeData,
      };

    case 'subagent':
      return {
        id,
        type: 'subagent',
        position,
        data: {
          ...baseData,
          role: step.config?.role || 'custom',
          tools: (step.config?.tools as string[]) || ['Read'],
          model: 'sonnet',
        } as SubagentNodeData,
      };

    case 'skill':
      return {
        id,
        type: 'skill',
        position,
        data: {
          ...baseData,
          skillType: (step.config?.skillType as 'official' | 'custom') || 'official',
          skillId: (step.config?.skillId as string) || undefined,
        } as SkillNodeData,
      };

    case 'mcp':
      return {
        id,
        type: 'mcp',
        position,
        data: {
          ...baseData,
          serverType: 'stdio',
          serverName: (step.config?.serverName as string) || '',
          serverConfig: {},
        } as McpNodeData,
      };

    case 'output':
      return {
        id,
        type: 'output',
        position,
        data: {
          ...baseData,
          outputType: (step.config?.outputType as 'auto' | 'markdown' | 'document') || 'auto',
        } as OutputNodeData,
      };
  }
}

export function generateWorkflowFromPrompt(prompt: string): GeneratedWorkflow {
  const steps = findMatchingPattern(prompt);
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  let previousNodeIds: string[] = [];

  steps.forEach((step, index) => {
    const node = createNodeFromStep(step, index, steps.length, [...previousNodeIds]);
    nodes.push(node);

    // Create edge from previous node to current node
    if (index > 0 && nodes[index - 1]) {
      edges.push({
        id: `e-${nodes[index - 1].id}-${node.id}`,
        source: nodes[index - 1].id,
        target: node.id,
        animated: true,
      });
    }

    previousNodeIds.push(node.id);
  });

  return { nodes, edges };
}

// Parse prompt to extract more specific configurations
export function enhanceWorkflowFromPrompt(
  workflow: GeneratedWorkflow,
  prompt: string
): GeneratedWorkflow {
  // Update node descriptions based on prompt content
  const enhancedNodes = workflow.nodes.map((node) => {
    if (node.type === 'input') {
      return {
        ...node,
        data: {
          ...node.data,
          value: prompt,
        },
      };
    }

    if (node.type === 'subagent') {
      // Extract specific instructions from prompt
      const data = node.data as SubagentNodeData;
      return {
        ...node,
        data: {
          ...data,
          systemPrompt: `Based on the user's request: "${prompt}"\n\n${data.description}`,
        },
      };
    }

    return node;
  });

  return {
    nodes: enhancedNodes as WorkflowNode[],
    edges: workflow.edges,
  };
}

export function generateAndEnhanceWorkflow(prompt: string): GeneratedWorkflow {
  const baseWorkflow = generateWorkflowFromPrompt(prompt);
  return enhanceWorkflowFromPrompt(baseWorkflow, prompt);
}

/**
 * AI 기반 워크플로우 생성 (서버 API 호출)
 */
export async function generateWorkflowWithAI(prompt: string): Promise<{
  workflow: GeneratedWorkflow;
  workflowName: string;
}> {
  const response = await fetch('/api/generate/workflow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate workflow');
  }

  const aiResult: AIWorkflowResult = await response.json();
  const workflow = convertAIResponseToWorkflow(aiResult);

  return {
    workflow,
    workflowName: aiResult.workflowName,
  };
}

/**
 * AI 응답을 React Flow 워크플로우로 변환
 */
function convertAIResponseToWorkflow(aiResult: AIWorkflowResult): GeneratedWorkflow {
  const nodes: WorkflowNode[] = [];
  const nodeIdMap: Map<number, string> = new Map();

  const xSpacing = 300;
  const startX = 100;
  const centerY = 200;

  // 노드 생성
  aiResult.nodes.forEach((aiNode, index) => {
    const id = nanoid();
    nodeIdMap.set(index, id);

    const position = {
      x: startX + index * xSpacing,
      y: centerY,
    };

    const baseData = {
      label: aiNode.label,
      description: aiNode.description,
      status: 'idle' as const,
      usedInputs: [] as string[],
    };

    switch (aiNode.type) {
      case 'input':
        nodes.push({
          id,
          type: 'input',
          position,
          data: {
            ...baseData,
            inputType: aiNode.config.inputType || 'text',
            placeholder: aiNode.config.placeholder || aiNode.description,
          } as InputNodeData,
        });
        break;

      case 'subagent':
        nodes.push({
          id,
          type: 'subagent',
          position,
          data: {
            ...baseData,
            role: (aiNode.config.role as AgentRole) || 'custom',
            tools: aiNode.config.tools || ['Read', 'Write'],
            model: (aiNode.config.model as 'sonnet' | 'opus' | 'haiku') || 'sonnet',
            systemPrompt: aiNode.config.systemPrompt,
          } as SubagentNodeData,
        });
        break;

      case 'skill':
        nodes.push({
          id,
          type: 'skill',
          position,
          data: {
            ...baseData,
            skillType: aiNode.config.skillType || 'official',
            skillId: aiNode.config.skillId,
            skillContent: aiNode.config.skillContent,
          } as SkillNodeData,
        });
        break;

      case 'mcp':
        nodes.push({
          id,
          type: 'mcp',
          position,
          data: {
            ...baseData,
            serverType: 'stdio',
            serverName: aiNode.label,
            serverConfig: {},
          } as McpNodeData,
        });
        break;

      case 'output':
        nodes.push({
          id,
          type: 'output',
          position,
          data: {
            ...baseData,
            outputType: aiNode.config.outputType || 'auto',
          } as OutputNodeData,
        });
        break;
    }
  });

  // 이전 노드 ID 연결 (usedInputs 설정)
  aiResult.edges.forEach((edge) => {
    const targetId = nodeIdMap.get(edge.to);
    const sourceId = nodeIdMap.get(edge.from);
    if (targetId && sourceId) {
      const targetNode = nodes.find((n) => n.id === targetId);
      if (targetNode && targetNode.data.usedInputs) {
        (targetNode.data.usedInputs as string[]).push(sourceId);
      }
    }
  });

  // 엣지 생성
  const edges: WorkflowEdge[] = aiResult.edges
    .map((edge) => {
      const sourceId = nodeIdMap.get(edge.from);
      const targetId = nodeIdMap.get(edge.to);
      if (!sourceId || !targetId) return null;

      return {
        id: `e-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        animated: true,
      };
    })
    .filter((edge): edge is WorkflowEdge => edge !== null);

  return { nodes, edges };
}
