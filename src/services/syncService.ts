import type { WorkflowNode, WorkflowEdge } from '../types/nodes';

interface NodeSyncData {
  id: string;
  type: string;
  label: string;
  description?: string;
  skillId?: string;
  skillPath?: string;
  tools?: string[];
  model?: string;
  skills?: string[];
  systemPrompt?: string;
  hookEvent?: string;
  hookMatcher?: string;
  hookCommand?: string;
}

/**
 * 노드 데이터를 동기화용 형식으로 변환
 */
function toSyncData(node: WorkflowNode): NodeSyncData {
  const base = {
    id: node.id,
    type: node.type,
    label: node.data.label,
    description: node.data.description,
  };

  switch (node.type) {
    case 'skill':
      return {
        ...base,
        skillId: (node.data as any).skillId,
        skillPath: (node.data as any).skillPath,
      };
    case 'agent':
      return {
        ...base,
        tools: (node.data as any).tools,
        model: (node.data as any).model,
        skills: (node.data as any).skills,
        systemPrompt: (node.data as any).systemPrompt,
      };
    case 'hook':
      return {
        ...base,
        hookEvent: (node.data as any).hookEvent,
        hookMatcher: (node.data as any).hookMatcher,
        hookCommand: (node.data as any).hookCommand,
      };
    default:
      return base;
  }
}

/**
 * 노드 생성/수정 시 파일 동기화
 */
export async function syncNode(node: WorkflowNode): Promise<boolean> {
  // input, output 노드는 동기화 불필요
  if (node.type === 'input' || node.type === 'output') {
    return true;
  }

  try {
    const response = await fetch('/api/sync/node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node: toSyncData(node) }),
    });

    if (!response.ok) {
      console.error('Failed to sync node:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to sync node:', error);
    return false;
  }
}

/**
 * 노드 삭제 시 파일 삭제 및 관련 참조 정리
 */
export async function deleteNode(node: WorkflowNode, allNodes: WorkflowNode[]): Promise<boolean> {
  if (node.type === 'input' || node.type === 'output') {
    return true;
  }

  try {
    const response = await fetch('/api/sync/node', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        node: toSyncData(node),
        nodes: allNodes.map(toSyncData),
      }),
    });

    if (!response.ok) {
      console.error('Failed to delete node:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete node:', error);
    return false;
  }
}

/**
 * 엣지 연결 시 관계 동기화
 */
export async function syncEdge(
  edge: WorkflowEdge,
  nodes: WorkflowNode[]
): Promise<boolean> {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  if (!sourceNode || !targetNode) {
    return true;
  }

  // input/output만 연결된 경우 동기화 불필요
  if (
    (sourceNode.type === 'input' || sourceNode.type === 'output') &&
    (targetNode.type === 'input' || targetNode.type === 'output')
  ) {
    return true;
  }

  try {
    const response = await fetch('/api/sync/edge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        edge: {
          source: edge.source,
          target: edge.target,
          sourceType: sourceNode.type,
          targetType: targetNode.type,
        },
        nodes: nodes.map(toSyncData),
      }),
    });

    if (!response.ok) {
      console.error('Failed to sync edge:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to sync edge:', error);
    return false;
  }
}

/**
 * 엣지 삭제 시 관계 동기화
 */
export async function removeEdge(
  edge: WorkflowEdge,
  nodes: WorkflowNode[]
): Promise<boolean> {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  if (!sourceNode || !targetNode) {
    return true;
  }

  try {
    const response = await fetch('/api/sync/edge', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        edge: {
          source: edge.source,
          target: edge.target,
          sourceType: sourceNode.type,
          targetType: targetNode.type,
        },
        nodes: nodes.map(toSyncData),
      }),
    });

    if (!response.ok) {
      console.error('Failed to remove edge:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to remove edge:', error);
    return false;
  }
}
