import { useEffect, useCallback } from 'react';
import { socketService, type NodeUpdateEvent, type ConsoleLogEvent } from '../services/socketService';
import { useWorkflowStore } from '../stores/workflowStore';
import { useExecutionStore } from '../stores/executionStore';

export function useWorkflowExecution() {
  const { nodes, edges, workflowId, workflowName, updateNodeStatus } = useWorkflowStore();
  const {
    isRunning,
    startExecution,
    stopExecution,
    setCurrentNode,
    markNodeCompleted,
    markNodeFailed,
    addLog,
  } = useExecutionStore();

  // Connect to socket on mount
  useEffect(() => {
    const handlers = {
      onNodeUpdate: (event: NodeUpdateEvent) => {
        updateNodeStatus(event.nodeId, event.status, event.progress);

        if (event.status === 'running') {
          setCurrentNode(event.nodeId);
        } else if (event.status === 'completed') {
          markNodeCompleted(event.nodeId, event.result);
        } else if (event.status === 'error') {
          markNodeFailed(event.nodeId, event.error);
        }
      },

      onConsoleLog: (event: ConsoleLogEvent) => {
        const levelMap: Record<string, 'info' | 'warning' | 'error' | 'debug' | 'success'> = {
          info: 'info',
          warn: 'warning',
          error: 'error',
          debug: 'debug',
        };
        addLog(levelMap[event.type] || 'info', event.message, event.nodeId);
      },

      onWorkflowStarted: () => {
        startExecution();
      },

      onWorkflowCompleted: () => {
        stopExecution();
        addLog('success', 'Workflow completed successfully');
      },

      onWorkflowError: (data: { workflowId: string; error: string }) => {
        stopExecution();
        addLog('error', `Workflow failed: ${data.error}`);
      },

      onWorkflowCancelled: () => {
        stopExecution();
        addLog('warning', 'Workflow execution cancelled');
      },
    };

    socketService.connect(handlers);

    return () => {
      socketService.disconnect();
    };
  }, [
    updateNodeStatus,
    setCurrentNode,
    markNodeCompleted,
    markNodeFailed,
    startExecution,
    stopExecution,
    addLog,
  ]);

  // Execute workflow
  const execute = useCallback(() => {
    if (nodes.length === 0) {
      addLog('warning', 'No nodes to execute');
      return;
    }

    // Sort nodes by execution order (topological sort based on edges)
    const sortedNodes = topologicalSort(nodes, edges);

    socketService.executeWorkflow({
      workflowId,
      workflowName,
      nodes: sortedNodes,
      edges,
    });
  }, [nodes, edges, workflowId, workflowName, addLog]);

  // Cancel execution
  const cancel = useCallback(() => {
    socketService.cancelExecution();
  }, []);

  return {
    isRunning,
    execute,
    cancel,
    isConnected: socketService.isConnected(),
  };
}

// Helper function for topological sort
function topologicalSort<T extends { id: string }>(
  nodes: T[],
  edges: Array<{ source: string; target: string }>
): T[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  // Initialize
  nodes.forEach((node) => {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  });

  // Build graph
  edges.forEach((edge) => {
    adjList.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // Find nodes with no incoming edges
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  // Process queue
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
