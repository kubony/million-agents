import { Download, FileText, Eye } from 'lucide-react';
import { useExecutionStore } from '../../stores/executionStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function PreviewPanel() {
  const { isRunning, results } = useExecutionStore();
  const { nodes } = useWorkflowStore();

  // Get the final output from the last output node
  const outputNodes = nodes.filter((n) => n.type === 'output');
  const lastResult = outputNodes.length > 0 ? results.get(outputNodes[0].id) : null;

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
        {lastResult ? (
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
