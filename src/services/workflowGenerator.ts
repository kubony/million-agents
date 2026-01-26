import { nanoid } from 'nanoid';
import type {
  WorkflowNode,
  WorkflowEdge,
  InputNodeData,
  AgentNodeData,
  SkillNodeData,
  HookNodeData,
  OutputNodeData,
  AgentRole,
} from '../types/nodes';
import { useSettingsStore } from '../stores/settingsStore';
import { useProjectStore } from '../stores/projectStore';

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
  type: 'input' | 'agent' | 'skill' | 'hook' | 'output';
  label: string;
  description: string;
  config: {
    inputType?: 'text' | 'file' | 'select';
    placeholder?: string;
    defaultValue?: string;
    role?: string;
    tools?: string[];
    model?: string;
    systemPrompt?: string;
    skillType?: 'official' | 'custom';
    skillId?: string;
    skillContent?: string;
    commandName?: string;
    commandPath?: string;
    hookEvent?: string;
    hookMatcher?: string;
    hookCommand?: string;
    outputType?: 'auto' | 'markdown' | 'document' | 'image';
  };
}

interface WorkflowStep {
  type: 'input' | 'agent' | 'skill' | 'hook' | 'output';
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
        type: 'agent',
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
        type: 'agent',
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
        type: 'agent',
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
        type: 'agent',
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
        type: 'agent',
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
        type: 'agent',
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
    type: 'agent',
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

    case 'agent':
      return {
        id,
        type: 'agent',
        position,
        data: {
          ...baseData,
          role: step.config?.role || 'custom',
          tools: (step.config?.tools as string[]) || ['Read'],
          model: 'sonnet',
        } as AgentNodeData,
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

    case 'hook':
      return {
        id,
        type: 'hook',
        position,
        data: {
          ...baseData,
          hookEvent: (step.config?.hookEvent as string) || 'PreToolUse',
          hookMatcher: (step.config?.hookMatcher as string) || '',
          hookCommand: (step.config?.hookCommand as string) || '',
        } as HookNodeData,
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

  // 트리 레이아웃 적용
  const layoutedNodes = applyTreeLayout(nodes, edges);

  return { nodes: layoutedNodes, edges };
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

    if (node.type === 'agent') {
      // Extract specific instructions from prompt
      const data = node.data as AgentNodeData;
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
 * @param prompt 워크플로우 설명 프롬프트
 * @param projectPath 저장할 프로젝트 경로 (선택, 없으면 currentProject 사용)
 */
export async function generateWorkflowWithAI(
  prompt: string,
  projectPath?: string
): Promise<{
  workflow: GeneratedWorkflow;
  workflowName: string;
}> {
  let response: Response;

  // Get settings from store
  const { apiMode, apiKey, proxyUrl } = useSettingsStore.getState();
  const { currentProject } = useProjectStore.getState();

  // projectPath가 없으면 currentProject.path 사용
  const targetPath = projectPath || currentProject?.path;

  if (!targetPath) {
    throw new Error('프로젝트를 먼저 선택해주세요. 홈에서 프로젝트를 선택하거나 새로 만드세요.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Mode': apiMode,
  };

  if (apiMode === 'direct' && apiKey) {
    headers['X-API-Key'] = apiKey;
  } else if (apiMode === 'proxy' && proxyUrl) {
    headers['X-Proxy-URL'] = proxyUrl;
  }

  try {
    response = await fetch('/api/generate/workflow', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, projectPath: targetPath }),
    });
  } catch (err) {
    throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
  }

  if (!response.ok) {
    let errorMessage = `서버 오류 (${response.status})`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch {
      // JSON 파싱 실패 시 기본 메시지 사용
    }
    throw new Error(errorMessage);
  }

  let aiResult: AIWorkflowResult;
  try {
    aiResult = await response.json();
  } catch {
    throw new Error('서버 응답을 파싱할 수 없습니다.');
  }

  const workflow = convertAIResponseToWorkflow(aiResult);

  return {
    workflow,
    workflowName: aiResult.workflowName,
  };
}

/**
 * 트리/병렬 레이아웃 알고리즘 (서브트리 기반)
 * 엣지 관계를 분석하여 노드를 트리 구조로 배치
 * 각 노드의 Y 위치는 서브트리 크기를 기반으로 계산하여 겹침 방지
 * @param nodes - 레이아웃을 적용할 노드 배열
 * @param edges - 노드 간 연결 정보
 * @returns 새로운 위치가 적용된 노드 배열
 */
export function applyTreeLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowNode[] {
  if (nodes.length === 0) return nodes;

  const xSpacing = 300;
  const ySpacing = 180; // 노드 간 Y 간격
  const startX = 100;
  const startY = 100;

  // 각 노드의 incoming/outgoing 엣지 맵 생성
  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, string[]>();

  nodes.forEach((node) => {
    incomingEdges.set(node.id, []);
    outgoingEdges.set(node.id, []);
  });

  edges.forEach((edge) => {
    const incoming = incomingEdges.get(edge.target) || [];
    incoming.push(edge.source);
    incomingEdges.set(edge.target, incoming);

    const outgoing = outgoingEdges.get(edge.source) || [];
    outgoing.push(edge.target);
    outgoingEdges.set(edge.source, outgoing);
  });

  // 루트 노드 찾기 (incoming edge가 없는 노드)
  const rootNodes = nodes.filter(
    (node) => (incomingEdges.get(node.id) || []).length === 0
  );

  // BFS로 각 노드의 depth 계산
  const nodeDepths = new Map<string, number>();
  const queue: { id: string; depth: number }[] = [];

  // 루트 노드들의 depth를 0으로 설정
  rootNodes.forEach((node) => {
    nodeDepths.set(node.id, 0);
    queue.push({ id: node.id, depth: 0 });
  });

  // 루트 노드가 없는 경우 (사이클이 있는 경우) 첫 번째 노드를 루트로
  if (rootNodes.length === 0 && nodes.length > 0) {
    nodeDepths.set(nodes[0].id, 0);
    queue.push({ id: nodes[0].id, depth: 0 });
  }

  // BFS 실행
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = outgoingEdges.get(current.id) || [];

    children.forEach((childId) => {
      const existingDepth = nodeDepths.get(childId);
      const newDepth = current.depth + 1;

      // 더 깊은 depth로 업데이트 (여러 부모가 있을 때 가장 깊은 값 사용)
      if (existingDepth === undefined || newDepth > existingDepth) {
        nodeDepths.set(childId, newDepth);
        queue.push({ id: childId, depth: newDepth });
      }
    });
  }

  // 각 노드의 서브트리 높이 계산 (리프 노드부터 역방향)
  const subtreeHeight = new Map<string, number>();
  const visited = new Set<string>();

  // 토폴로지 정렬된 순서로 처리 (depth가 큰 것부터)
  const sortedNodes = [...nodes].sort((a, b) => {
    const depthA = nodeDepths.get(a.id) ?? 0;
    const depthB = nodeDepths.get(b.id) ?? 0;
    return depthB - depthA; // 역순 (깊은 노드부터)
  });

  // 서브트리 높이 계산
  function calculateSubtreeHeight(nodeId: string): number {
    if (subtreeHeight.has(nodeId)) return subtreeHeight.get(nodeId)!;

    const children = outgoingEdges.get(nodeId) || [];

    if (children.length === 0) {
      // 리프 노드: 높이 1
      subtreeHeight.set(nodeId, 1);
      return 1;
    }

    // 자식들의 서브트리 높이 합
    let totalChildrenHeight = 0;
    children.forEach((childId) => {
      totalChildrenHeight += calculateSubtreeHeight(childId);
    });

    // 자신의 높이는 자식들의 합 (최소 1)
    const height = Math.max(1, totalChildrenHeight);
    subtreeHeight.set(nodeId, height);
    return height;
  }

  // 모든 노드의 서브트리 높이 계산
  sortedNodes.forEach((node) => {
    calculateSubtreeHeight(node.id);
  });

  // 노드 위치 계산 (루트부터 DFS로)
  const nodePositions = new Map<string, { x: number; y: number }>();

  function assignPositions(
    nodeId: string,
    depth: number,
    yStart: number,
    yEnd: number
  ): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const nodeHeight = subtreeHeight.get(nodeId) || 1;
    const yRange = yEnd - yStart;

    // 노드 Y 위치: 할당된 범위의 중앙
    const y = yStart + yRange / 2;
    const x = startX + depth * xSpacing;

    nodePositions.set(nodeId, { x, y });

    // 자식 노드들에 Y 범위 할당
    const children = outgoingEdges.get(nodeId) || [];
    if (children.length > 0) {
      let currentY = yStart;

      children.forEach((childId) => {
        const childHeight = subtreeHeight.get(childId) || 1;
        const childYRange = (childHeight / nodeHeight) * yRange;

        assignPositions(
          childId,
          depth + 1,
          currentY,
          currentY + childYRange
        );

        currentY += childYRange;
      });
    }
  }

  // 시작 Y 위치
  let currentY = startY;

  // 루트 노드들 처리
  rootNodes.forEach((node) => {
    const nodeHeight = subtreeHeight.get(node.id) || 1;
    const nodeYRange = nodeHeight * ySpacing;

    visited.clear(); // 각 루트별로 visited 초기화
    assignPositions(node.id, 0, currentY, currentY + nodeYRange);

    currentY += nodeYRange;
  });

  // depth가 계산되지 않은 고립된 노드 처리
  nodes.forEach((node) => {
    if (!nodePositions.has(node.id)) {
      nodePositions.set(node.id, {
        x: startX,
        y: currentY,
      });
      currentY += ySpacing;
    }
  });

  // 노드에 새 위치 적용
  return nodes.map((node) => {
    const position = nodePositions.get(node.id) || node.position;
    return {
      ...node,
      position,
    };
  });
}

/**
 * AI 응답을 React Flow 워크플로우로 변환
 */
function convertAIResponseToWorkflow(aiResult: AIWorkflowResult): GeneratedWorkflow {
  const nodes: WorkflowNode[] = [];
  const nodeIdMap: Map<number, string> = new Map();

  // 임시 위치로 노드 생성 (트리 레이아웃에서 재계산됨)
  const tempPosition = { x: 0, y: 0 };

  // 노드 생성
  aiResult.nodes.forEach((aiNode, index) => {
    const id = nanoid();
    nodeIdMap.set(index, id);

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
          position: { ...tempPosition },
          data: {
            ...baseData,
            inputType: aiNode.config.inputType || 'text',
            placeholder: aiNode.config.placeholder || aiNode.description,
            value: aiNode.config.defaultValue || '',
            defaultValue: aiNode.config.defaultValue || '',
          } as InputNodeData,
        });
        break;

      case 'agent':
        nodes.push({
          id,
          type: 'agent',
          position: { ...tempPosition },
          data: {
            ...baseData,
            role: (aiNode.config.role as AgentRole) || 'custom',
            tools: aiNode.config.tools || ['Read', 'Write'],
            model: (aiNode.config.model as 'sonnet' | 'opus' | 'haiku') || 'sonnet',
            systemPrompt: aiNode.config.systemPrompt,
          } as AgentNodeData,
        });
        break;

      case 'skill':
        nodes.push({
          id,
          type: 'skill',
          position: { ...tempPosition },
          data: {
            ...baseData,
            skillType: aiNode.config.skillType || 'official',
            skillId: aiNode.config.skillId,
            skillContent: aiNode.config.skillContent,
          } as SkillNodeData,
        });
        break;

      case 'hook':
        nodes.push({
          id,
          type: 'hook',
          position: { ...tempPosition },
          data: {
            ...baseData,
            hookEvent: aiNode.config.hookEvent || 'PreToolUse',
            hookMatcher: aiNode.config.hookMatcher,
            hookCommand: aiNode.config.hookCommand,
          } as HookNodeData,
        });
        break;

      case 'output':
        nodes.push({
          id,
          type: 'output',
          position: { ...tempPosition },
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
      } as WorkflowEdge;
    })
    .filter((edge): edge is WorkflowEdge => edge !== null);

  // 트리 레이아웃 적용
  const layoutedNodes = applyTreeLayout(nodes, edges);

  return { nodes: layoutedNodes, edges };
}
