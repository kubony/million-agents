import { useState } from 'react';
import { ArrowLeft, Settings, Save, Download, Play } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';
import { generateClaudeConfig } from '../../utils/claudeConfigGenerator';
import SaveDialog from '../dialogs/SaveDialog';
import type { ClaudeConfigExport } from '../../types/save';

export default function Header() {
  const { workflowName, setWorkflowName, isDraft, nodes, edges } = useWorkflowStore();
  const { isRunning, execute } = useWorkflowExecution();
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState<ClaudeConfigExport | null>(null);

  const handleExport = () => {
    const config = generateClaudeConfig(workflowName, nodes, edges, 'local');
    setExportConfig(config);
    setIsSaveDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsSaveDialogOpen(false);
    setExportConfig(null);
  };

  const handleRun = () => {
    if (!isRunning) {
      execute();
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-transparent border-none text-lg font-semibold text-white focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1"
          />

          {isDraft && (
            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400 rounded">
              Draft
            </span>
          )}
        </div>
      </div>

      {/* Center section - Title */}
      <div className="text-sm font-medium text-gray-400">
        Visual Workflow Builder
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Saved</span>

        <button
          onClick={handleRun}
          disabled={isRunning}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
            ${isRunning
              ? 'bg-gray-500 cursor-not-allowed text-white'
              : 'bg-accent hover:bg-accent-hover text-white'
            }
          `}
        >
          <Play className="w-4 h-4" />
          {isRunning ? 'Running...' : 'Run'}
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 bg-surface-hover hover:bg-border rounded-lg transition-colors"
        >
          <Download className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Export</span>
        </button>

        <button className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
          <Save className="w-5 h-5 text-gray-400" />
        </button>

        <button className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
          <Settings className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Save Dialog */}
      {exportConfig && (
        <SaveDialog
          isOpen={isSaveDialogOpen}
          onClose={handleCloseDialog}
          config={exportConfig}
        />
      )}
    </header>
  );
}
