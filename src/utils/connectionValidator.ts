import type { Connection, Node } from '@xyflow/react';

/**
 * Validates if a connection between two nodes is allowed
 * Rules:
 * - Output nodes cannot have outgoing connections
 * - Input nodes cannot have incoming connections
 * - No circular connections allowed
 * - Self-connections not allowed
 */
export function validateConnection(
  connection: Connection,
  nodes: Node[]
): boolean {
  const { source, target } = connection;

  // Self-connection check
  if (source === target) {
    return false;
  }

  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);

  if (!sourceNode || !targetNode) {
    return false;
  }

  // Output nodes cannot have outgoing connections
  if (sourceNode.type === 'output') {
    console.warn('Output nodes cannot have outgoing connections');
    return false;
  }

  // Input nodes cannot have incoming connections
  if (targetNode.type === 'input') {
    console.warn('Input nodes cannot have incoming connections');
    return false;
  }

  return true;
}

/**
 * Check for circular dependencies in the graph
 */
export function hasCircularDependency(
  nodes: Node[],
  edges: { source: string; target: string }[],
  newEdge: { source: string; target: string }
): boolean {
  const allEdges = [...edges, newEdge];
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);

    const outgoing = allEdges.filter((e) => e.source === nodeId);
    for (const edge of outgoing) {
      if (!visited.has(edge.target)) {
        if (dfs(edge.target)) {
          return true;
        }
      } else if (recStack.has(edge.target)) {
        return true;
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        return true;
      }
    }
  }

  return false;
}
