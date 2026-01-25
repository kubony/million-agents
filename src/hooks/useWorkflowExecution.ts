import { useCallback, useState, useEffect, useRef } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';
import { useExecutionStore } from '../stores/executionStore';
import {
  socketService,
  type NodeUpdateEvent,
  type ConsoleLogEvent,
  type WorkflowCompletedData,
} from '../services/socketService';

export function useWorkflowExecution() {
  const { nodes, edges, workflowName, updateNodeStatus } = useWorkflowStore();
  const {
    isRunning,
    startExecution,
    stopExecution,
    setCurrentNode,
    markNodeCompleted,
    markNodeFailed,
    setWorkflowResults,
    addLog,
    clearLogs,
  } = useExecutionStore();

  const [savedOutputDir, setSavedOutputDir] = useState<string | null>(null);
  const workflowIdRef = useRef<string | null>(null);

  // Socket.IO 이벤트 리스너 등록
  useEffect(() => {
    // 노드 업데이트 이벤트
    const handleNodeUpdate = (update: NodeUpdateEvent) => {
      const { nodeId, status, progress, result, error } = update;

      if (status === 'running') {
        updateNodeStatus(nodeId, 'running', progress || 0);
        setCurrentNode(nodeId);
      } else if (status === 'completed') {
        updateNodeStatus(nodeId, 'completed', 100);
        markNodeCompleted(nodeId, result);
      } else if (status === 'error') {
        updateNodeStatus(nodeId, 'error', 0);
        markNodeFailed(nodeId, error || 'Unknown error');
      }
    };

    // 콘솔 로그 이벤트
    const handleConsoleLog = (log: ConsoleLogEvent) => {
      const level = log.type === 'warn' ? 'warning' : log.type === 'debug' ? 'info' : log.type;
      addLog(level as 'info' | 'warning' | 'error' | 'success', log.message, log.nodeId);
    };

    // 워크플로우 완료 이벤트
    const handleWorkflowCompleted = (data: WorkflowCompletedData) => {
      if (data.results) {
        setWorkflowResults(data.results);
      }
      if (data.outputDir) {
        setSavedOutputDir(data.outputDir);
      }
      stopExecution();
      addLog('success', '워크플로우 실행 완료!');
    };

    // 워크플로우 에러 이벤트
    const handleWorkflowError = (data: { workflowId: string; error: string }) => {
      stopExecution();
      addLog('error', `실행 오류: ${data.error}`);
    };

    // 워크플로우 취소 이벤트
    const handleWorkflowCancelled = () => {
      stopExecution();
      addLog('warning', '워크플로우 실행이 취소되었습니다.');
    };

    // 이벤트 리스너 등록
    socketService.on('node:update', handleNodeUpdate);
    socketService.on('console:log', handleConsoleLog);
    socketService.on('workflow:completed', handleWorkflowCompleted);
    socketService.on('workflow:error', handleWorkflowError);
    socketService.on('workflow:cancelled', handleWorkflowCancelled);

    // 클린업
    return () => {
      socketService.off('node:update', handleNodeUpdate);
      socketService.off('console:log', handleConsoleLog);
      socketService.off('workflow:completed', handleWorkflowCompleted);
      socketService.off('workflow:error', handleWorkflowError);
      socketService.off('workflow:cancelled', handleWorkflowCancelled);
    };
  }, [addLog, markNodeCompleted, markNodeFailed, setCurrentNode, setWorkflowResults, stopExecution, updateNodeStatus]);

  // Socket.IO를 통해 서버에서 워크플로우 실행 (Claude CLI 사용)
  const execute = useCallback(() => {
    if (nodes.length === 0) {
      addLog('warning', 'No nodes to execute');
      return;
    }

    // Clear previous logs and start
    clearLogs();
    startExecution();
    setSavedOutputDir(null);

    // 워크플로우 ID 생성
    const workflowId = `workflow-${Date.now()}`;
    workflowIdRef.current = workflowId;

    addLog('info', `워크플로우 "${workflowName}" 실행 시작 (Claude CLI)...`);

    // Socket.IO로 워크플로우 실행 요청
    socketService.executeWorkflow({
      workflowId,
      workflowName,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type || 'unknown',
        data: n.data as Record<string, unknown>,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    });
  }, [nodes, edges, workflowName, addLog, clearLogs, startExecution]);

  return {
    isRunning,
    execute,
    savedOutputDir,
  };
}
