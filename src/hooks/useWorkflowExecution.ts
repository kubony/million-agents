import { useCallback, useState } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';
import { useExecutionStore } from '../stores/executionStore';
import { executeWorkflow } from '../services/localExecutor';
import type { WorkflowResult } from '../services/socketService';

// 워크플로우 결과를 로컬 프로젝트에 저장하는 API 호출
async function saveWorkflowOutput(
  workflowName: string,
  files: Array<{ name: string; content: string }>
): Promise<{ success: boolean; outputDir?: string; error?: string }> {
  try {
    const response = await fetch('/api/save/workflow-output', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowName, files }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save files',
    };
  }
}

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

  // Execute workflow locally (no server needed)
  const execute = useCallback(async () => {
    if (nodes.length === 0) {
      addLog('warning', 'No nodes to execute');
      return;
    }

    // Clear previous logs and start
    clearLogs();
    startExecution();
    setSavedOutputDir(null);

    addLog('info', `워크플로우 "${workflowName}" 실행 시작...`);

    try {
      const results = await executeWorkflow(nodes, edges, {
        onNodeStart: (nodeId) => {
          updateNodeStatus(nodeId, 'running', 0);
          setCurrentNode(nodeId);
        },
        onNodeProgress: (nodeId, progress) => {
          updateNodeStatus(nodeId, 'running', progress);
        },
        onNodeComplete: (nodeId, result) => {
          updateNodeStatus(nodeId, 'completed', 100);
          markNodeCompleted(nodeId, result);
        },
        onNodeError: (nodeId, error) => {
          updateNodeStatus(nodeId, 'error', 0);
          markNodeFailed(nodeId, error);
        },
        onLog: (level, message, nodeId) => {
          addLog(level, message, nodeId);
        },
      });

      // Collect results for display
      const workflowResults: WorkflowResult[] = [];
      const files: Array<{ name: string; content: string }> = [];

      for (const [nodeId, result] of results) {
        const node = nodes.find((n) => n.id === nodeId);
        const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

        workflowResults.push({
          nodeId,
          label: node?.data.label || nodeId,
          success: true,
          result: resultText,
        });

        // Collect output node results for saving
        if (node?.type === 'output') {
          const fileName = `${node.data.label.replace(/\s+/g, '_')}.md`;
          files.push({
            name: fileName,
            content: resultText,
          });
        }
      }

      setWorkflowResults(workflowResults);
      stopExecution();
      addLog('success', '워크플로우 실행 완료!');

      // Save files to local project
      if (files.length > 0) {
        addLog('info', `${files.length}개 파일 저장 중...`);

        const saveResult = await saveWorkflowOutput(workflowName, files);

        if (saveResult.success && saveResult.outputDir) {
          setSavedOutputDir(saveResult.outputDir);
          addLog('info', `파일 저장 완료: ${saveResult.outputDir}`);
          files.forEach((file) => {
            addLog('info', `  - ${file.name}`);
          });
        } else {
          addLog('error', `파일 저장 실패: ${saveResult.error}`);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      stopExecution();
      addLog('error', `실행 오류: ${errorMessage}`);
    }
  }, [nodes, edges, workflowName, addLog, clearLogs, startExecution, stopExecution, updateNodeStatus, setCurrentNode, markNodeCompleted, markNodeFailed, setWorkflowResults]);

  return {
    isRunning,
    execute,
    savedOutputDir,
  };
}
