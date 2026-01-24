import { useCallback, useState } from 'react';
import { useWorkflowStore } from '../stores/workflowStore';
import { useExecutionStore } from '../stores/executionStore';
import { executeWorkflow } from '../services/localExecutor';
import type { WorkflowResult } from '../services/socketService';

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

  const [generatedFiles, setGeneratedFiles] = useState<Array<{ name: string; content: string }>>([]);

  // Execute workflow locally (no server needed)
  const execute = useCallback(async () => {
    if (nodes.length === 0) {
      addLog('warning', 'No nodes to execute');
      return;
    }

    // Clear previous logs and start
    clearLogs();
    startExecution();
    setGeneratedFiles([]);

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

        // Generate downloadable file for output nodes
        if (node?.type === 'output') {
          const fileName = `${workflowName.replace(/\s+/g, '_')}_${node.data.label.replace(/\s+/g, '_')}.md`;
          files.push({
            name: fileName,
            content: resultText,
          });
        }
      }

      setGeneratedFiles(files);
      setWorkflowResults(workflowResults);
      stopExecution();
      addLog('success', '워크플로우 실행 완료!');

      // Auto-download files
      if (files.length > 0) {
        addLog('info', `${files.length}개 파일 생성됨`);
        files.forEach((file) => {
          addLog('info', `  - ${file.name}`);
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      stopExecution();
      addLog('error', `실행 오류: ${errorMessage}`);
    }
  }, [nodes, edges, workflowName, addLog, clearLogs, startExecution, stopExecution, updateNodeStatus, setCurrentNode, markNodeCompleted, markNodeFailed, setWorkflowResults]);

  // Download a file
  const downloadFile = useCallback((fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('info', `파일 다운로드: ${fileName}`);
  }, [addLog]);

  // Download all generated files
  const downloadAllFiles = useCallback(() => {
    generatedFiles.forEach((file) => {
      downloadFile(file.name, file.content);
    });
  }, [generatedFiles, downloadFile]);

  return {
    isRunning,
    execute,
    generatedFiles,
    downloadFile,
    downloadAllFiles,
  };
}
