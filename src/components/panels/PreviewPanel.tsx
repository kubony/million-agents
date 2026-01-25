import { useState, useEffect } from 'react';
import {
  FolderOpen,
  FileText,
  Eye,
  Play,
  MessageSquare,
  Upload,
  Image,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useExecutionStore } from '../../stores/executionStore';
import { useWorkflowStore, selectSelectedNode } from '../../stores/workflowStore';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { InputNodeData } from '../../types/nodes';

export default function PreviewPanel() {
  const { isRunning, results, workflowResults, logs } = useExecutionStore();
  const { nodes, selectedNodeId, updateNode } = useWorkflowStore();
  const selectedNode = useWorkflowStore(selectSelectedNode);
  const { execute, savedOutputDir } = useWorkflowExecution();

  // Local state for input value during editing
  const [inputValue, setInputValue] = useState('');

  // Sync input value when selected node changes
  useEffect(() => {
    if (selectedNode?.type === 'input') {
      const data = selectedNode.data as InputNodeData;
      setInputValue(data.value || '');
    }
  }, [selectedNodeId, selectedNode]);

  // Get the final output from the last output node
  const outputNodes = nodes.filter((n) => n.type === 'output');
  const lastResult = outputNodes.length > 0 ? results.get(outputNodes[0].id) : null;

  // Check if selected node is an input node
  const isInputNodeSelected = selectedNode?.type === 'input';
  const inputNodeData = isInputNodeSelected ? (selectedNode.data as InputNodeData) : null;

  // Handle input value change
  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (selectedNodeId) {
      updateNode(selectedNodeId, { value });
    }
  };

  // Handle test run - execute the workflow
  const handleTestRun = () => {
    execute();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">Preview</h3>
        </div>
        {isRunning && (
          <span className="text-sm text-blue-400 animate-pulse">Running...</span>
        )}
      </div>

      {/* Execution Progress */}
      {isRunning && (
        <div className="p-4 border-b border-border">
          <div className="space-y-3">
            {nodes.map((node) => (
              <div key={node.id} className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    node.data.status === 'completed'
                      ? 'bg-green-500'
                      : node.data.status === 'running'
                      ? 'bg-blue-500 animate-pulse'
                      : node.data.status === 'error'
                      ? 'bg-red-500'
                      : 'bg-gray-500'
                  }`}
                />
                <span className="text-sm text-gray-300">{node.data.label}</span>
                {node.data.status === 'running' && node.data.progress !== undefined && (
                  <span className="text-xs text-gray-500">{node.data.progress}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run Button - Always visible */}
      <div className="p-4 border-b border-border">
        <button
          onClick={handleTestRun}
          disabled={isRunning || nodes.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          <Play className="w-4 h-4" />
          {isRunning ? 'Running...' : 'Run Workflow'}
        </button>
        {nodes.length === 0 && (
          <p className="text-xs text-gray-500 text-center mt-2">노드를 추가해주세요</p>
        )}
      </div>

      {/* Result Display */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Input Node Form - show when input node is selected */}
        {isInputNodeSelected && inputNodeData && (
          <div className="space-y-4 mb-4 p-4 bg-surface rounded-lg border border-border">
            {/* Input Header */}
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-500" />
              <h4 className="text-md font-medium text-white">{inputNodeData.label}</h4>
            </div>

            {/* Text Input */}
            {inputNodeData.inputType === 'text' && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">
                  {inputNodeData.description || 'Enter your input'}
                </label>
                <textarea
                  className="w-full h-32 px-3 py-2 text-sm bg-surface border border-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                  placeholder={inputNodeData.placeholder || 'Type your message here...'}
                  value={inputValue || inputNodeData.value || ''}
                  onChange={(e) => handleInputChange(e.target.value)}
                />
              </div>
            )}

            {/* File Input */}
            {inputNodeData.inputType === 'file' && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">
                  {inputNodeData.description || 'Upload a file'}
                </label>
                <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-lg hover:border-amber-500 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-500 mb-2" />
                  <p className="text-sm text-gray-400">Drop files here or click to upload</p>
                  {inputNodeData.fileTypes && (
                    <p className="text-xs text-gray-500 mt-1">
                      Supported: {inputNodeData.fileTypes.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Select Input */}
            {inputNodeData.inputType === 'select' && inputNodeData.options && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">
                  {inputNodeData.description || 'Select an option'}
                </label>
                <select
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={inputValue || inputNodeData.value || ''}
                  onChange={(e) => handleInputChange(e.target.value)}
                >
                  <option value="">Select...</option>
                  {inputNodeData.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Saved Output Directory */}
        {savedOutputDir && (
          <div className="mb-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="w-5 h-5 text-green-400" />
              <h4 className="text-sm font-medium text-green-300">파일 저장 완료</h4>
            </div>
            <p className="text-xs text-gray-400 break-all">{savedOutputDir}</p>
          </div>
        )}

        {/* Workflow Results Display */}
        {workflowResults.length > 0 ? (
          <div className="space-y-4">
            {/* Results by Node */}
            {workflowResults.map((result) => (
              <div
                key={result.nodeId}
                className={`p-4 rounded-lg border ${
                  result.success
                    ? 'bg-surface border-border'
                    : 'bg-red-900/20 border-red-700'
                }`}
              >
                {/* Node Header */}
                <div className="flex items-center gap-2 mb-3">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <h5 className="text-sm font-medium text-white">{result.label}</h5>
                </div>

                {/* Error Message */}
                {result.error && (
                  <p className="text-sm text-red-400 mb-3">{result.error}</p>
                )}

                {/* Generated Files */}
                {result.files && result.files.length > 0 && (
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-gray-400">생성된 파일:</p>
                    {result.files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-surface-hover rounded"
                      >
                        {file.type === 'image' ? (
                          <Image className="w-4 h-4 text-purple-400" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{file.name}</p>
                          <p className="text-xs text-gray-500 truncate">{file.path}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Result Text (collapsible) */}
                {result.result && (
                  <details className="group" open>
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                      결과 보기
                    </summary>
                    <div className="mt-2 p-2 bg-black/30 rounded max-h-64 overflow-y-auto">
                      <div className="markdown-content text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {result.result.length > 2000
                            ? result.result.substring(0, 2000) + '...'
                            : result.result}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : lastResult ? (
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {typeof lastResult === 'string' ? lastResult : JSON.stringify(lastResult, null, 2)}
            </ReactMarkdown>
          </div>
        ) : logs.length > 0 ? (
          // Show logs when running
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white mb-3">실행 로그</h4>
            {logs.slice(-20).map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-xs">
                <span className="text-gray-500 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('ko-KR')}
                </span>
                <span className={
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warning' ? 'text-yellow-400' :
                  log.level === 'success' ? 'text-green-400' :
                  'text-gray-300'
                }>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FileText className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">Run the workflow to see results</p>
            <p className="text-xs mt-2">노드를 연결하고 Run Workflow 버튼을 클릭하세요</p>
          </div>
        )}
      </div>

    </div>
  );
}
