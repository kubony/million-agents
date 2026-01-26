import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, Download, Play, Trash2, RefreshCw, Home } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useProjectStore } from '../../stores/projectStore';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';
import { generateClaudeConfig } from '../../utils/claudeConfigGenerator';
import { loadClaudeConfig } from '../../services/configLoader';
import SaveDialog from '../dialogs/SaveDialog';
import SettingsDialog from '../dialogs/SettingsDialog';
import type { ClaudeConfigExport } from '../../types/save';

export default function Header() {
  const navigate = useNavigate();
  const { workflowName, setWorkflowName, isDraft, nodes, edges, clearWorkflow, mergeExistingConfig } = useWorkflowStore();
  const { makeccHome, navigateToPath, setCurrentProject } = useProjectStore();
  const { isRunning, execute } = useWorkflowExecution();
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState<ClaudeConfigExport | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  const handleReloadConfig = useCallback(async () => {
    setIsReloading(true);
    try {
      const loadedNodes = await loadClaudeConfig();
      if (loadedNodes.length > 0) {
        mergeExistingConfig(loadedNodes);
      }
    } catch (error) {
      console.error('Failed to reload config:', error);
    } finally {
      setIsReloading(false);
    }
  }, [mergeExistingConfig]);

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

  const handleClearWorkflow = () => {
    if (nodes.length === 0) return;
    if (window.confirm('모든 워크플로우를 삭제하시겠습니까?')) {
      clearWorkflow();
    }
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-surface border-b border-border">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            // Navigate Explorer to makeccHome and clear currentProject
            if (makeccHome) {
              navigateToPath(makeccHome);
            }
            setCurrentProject(null);
            navigate('/');
          }}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors group"
          title="Back to Home"
        >
          <Home className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
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

        <button
          onClick={handleReloadConfig}
          disabled={isReloading}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
            ${isReloading
              ? 'bg-surface-hover cursor-not-allowed opacity-50'
              : 'bg-surface-hover hover:bg-blue-500/20 hover:text-blue-400'
            }
          `}
          title=".claude/ 폴더에서 다시 로드"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${isReloading ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium text-gray-300">Reload</span>
        </button>

        <button
          onClick={handleClearWorkflow}
          disabled={nodes.length === 0}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
            ${nodes.length === 0
              ? 'bg-surface-hover cursor-not-allowed opacity-50'
              : 'bg-surface-hover hover:bg-red-500/20 hover:text-red-400'
            }
          `}
          title="모든 노드 삭제"
        >
          <Trash2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Clear</span>
        </button>

        <button className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
          <Save className="w-5 h-5 text-gray-400" />
        </button>

        <button
          onClick={() => setIsSettingsDialogOpen(true)}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          title="설정"
        >
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

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsDialogOpen}
        onClose={() => setIsSettingsDialogOpen(false)}
      />
    </header>
  );
}
