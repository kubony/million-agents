import { useState, useEffect } from 'react';
import { Download, FileText, Eye, Play, MessageSquare, Upload } from 'lucide-react';
import { useExecutionStore } from '../../stores/executionStore';
import { useWorkflowStore, selectSelectedNode } from '../../stores/workflowStore';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { InputNodeData } from '../../types/nodes';

export default function PreviewPanel() {
  const { isRunning, results } = useExecutionStore();
  const { nodes, selectedNodeId, updateNode } = useWorkflowStore();
  const selectedNode = useWorkflowStore(selectSelectedNode);
  const { execute } = useWorkflowExecution();

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

      {/* Result Display */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Input Node Form */}
        {isInputNodeSelected && inputNodeData ? (
          <div className="space-y-4">
            {/* Input Header */}
            <div className="flex items-center gap-2 mb-4">
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

            {/* Test Run Button */}
            <button
              onClick={handleTestRun}
              disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Test Workflow'}
            </button>
          </div>
        ) : lastResult ? (
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {typeof lastResult === 'string' ? lastResult : JSON.stringify(lastResult, null, 2)}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FileText className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">Run the workflow to see results</p>
          </div>
        )}
      </div>

      {/* Download Actions */}
      {lastResult && (
        <div className="flex items-center gap-2 p-4 border-t border-border">
          <button className="flex items-center gap-2 px-3 py-2 bg-surface-hover rounded-lg text-sm hover:bg-border transition-colors">
            <Download className="w-4 h-4" />
            Download .md
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-surface-hover rounded-lg text-sm hover:bg-border transition-colors">
            <FileText className="w-4 h-4" />
            Export .docx
          </button>
        </div>
      )}
    </div>
  );
}
