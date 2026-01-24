import { useState, useEffect } from 'react';
import { X, Download, FolderOpen, Check, AlertCircle, FileText, Bot, Terminal, Settings } from 'lucide-react';
import clsx from 'clsx';
import type { ClaudeConfigExport, SaveOptions, SaveLocation, SaveResult } from '../../types/save';
import { saveWorkflowAsClaudeConfig, previewSaveFiles, getProjectPath } from '../../services/saveService';

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  config: ClaudeConfigExport;
}

interface FilePreview {
  path: string;
  content: string;
  type: string;
}

export default function SaveDialog({ isOpen, onClose, config }: SaveDialogProps) {
  const [location, setLocation] = useState<SaveLocation>('local');
  const [includeSkills, setIncludeSkills] = useState(true);
  const [includeCommands, setIncludeCommands] = useState(true);
  const [includeAgents, setIncludeAgents] = useState(true);
  const [includeMcpSettings, setIncludeMcpSettings] = useState(true);
  const [projectPath, setProjectPath] = useState<string>('');
  const [previewFiles, setPreviewFiles] = useState<FilePreview[]>([]);
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch project path on mount
  useEffect(() => {
    if (isOpen) {
      getProjectPath()
        .then(setProjectPath)
        .catch(() => setProjectPath('.'));
    }
  }, [isOpen]);

  // Update preview files when options change
  useEffect(() => {
    if (!isOpen) return;

    const options: SaveOptions = {
      location,
      includeSkills,
      includeCommands,
      includeAgents,
      includeMcpSettings,
    };

    previewSaveFiles(config, options).then(({ files }) => {
      setPreviewFiles(files);
      if (files.length > 0 && !selectedFile) {
        setSelectedFile(files[0]);
      }
    });
  }, [isOpen, config, location, includeSkills, includeCommands, includeAgents, includeMcpSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveResult(null);

    const options: SaveOptions = {
      location,
      includeSkills,
      includeCommands,
      includeAgents,
      includeMcpSettings,
    };

    try {
      const result = await saveWorkflowAsClaudeConfig(config, options);
      setSaveResult(result);
      if (result.success) {
        setTimeout(() => onClose(), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'skill': return <FileText className="w-4 h-4 text-node-skill" />;
      case 'agent': return <Bot className="w-4 h-4 text-node-generate" />;
      case 'command': return <Terminal className="w-4 h-4 text-accent" />;
      case 'mcp': return <Settings className="w-4 h-4 text-node-mcp" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const hasContent = config.skills.length > 0 || config.commands.length > 0 ||
                     config.agents.length > 0 || config.mcpSettings;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-[900px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-white">Export to Claude Code</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - Options */}
          <div className="w-64 border-r border-border p-4 space-y-6 overflow-y-auto">
            {/* Save Location */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Save Location
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setLocation('local')}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left',
                    location === 'local'
                      ? 'border-accent bg-accent/10 text-white'
                      : 'border-border hover:border-gray-500 text-gray-400'
                  )}
                >
                  <FolderOpen className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-medium">Local</div>
                    <div className="text-xs text-gray-500">.claude/</div>
                  </div>
                </button>
                <button
                  onClick={() => setLocation('global')}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left',
                    location === 'global'
                      ? 'border-accent bg-accent/10 text-white'
                      : 'border-border hover:border-gray-500 text-gray-400'
                  )}
                >
                  <FolderOpen className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-medium">Global</div>
                    <div className="text-xs text-gray-500">~/.claude/</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Include Options */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Include Files
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSkills}
                    onChange={(e) => setIncludeSkills(e.target.checked)}
                    disabled={config.skills.length === 0}
                    className="w-4 h-4 rounded border-border bg-surface text-accent focus:ring-accent"
                  />
                  <span className={clsx(
                    'text-sm',
                    config.skills.length === 0 ? 'text-gray-600' : 'text-gray-300'
                  )}>
                    Skills ({config.skills.length})
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCommands}
                    onChange={(e) => setIncludeCommands(e.target.checked)}
                    disabled={config.commands.length === 0}
                    className="w-4 h-4 rounded border-border bg-surface text-accent focus:ring-accent"
                  />
                  <span className={clsx(
                    'text-sm',
                    config.commands.length === 0 ? 'text-gray-600' : 'text-gray-300'
                  )}>
                    Commands ({config.commands.length})
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAgents}
                    onChange={(e) => setIncludeAgents(e.target.checked)}
                    disabled={config.agents.length === 0}
                    className="w-4 h-4 rounded border-border bg-surface text-accent focus:ring-accent"
                  />
                  <span className={clsx(
                    'text-sm',
                    config.agents.length === 0 ? 'text-gray-600' : 'text-gray-300'
                  )}>
                    Agents ({config.agents.length})
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMcpSettings}
                    onChange={(e) => setIncludeMcpSettings(e.target.checked)}
                    disabled={!config.mcpSettings}
                    className="w-4 h-4 rounded border-border bg-surface text-accent focus:ring-accent"
                  />
                  <span className={clsx(
                    'text-sm',
                    !config.mcpSettings ? 'text-gray-600' : 'text-gray-300'
                  )}>
                    MCP Settings
                  </span>
                </label>
              </div>
            </div>

            {/* Project Path Info */}
            <div className="pt-4 border-t border-border">
              <div className="text-xs text-gray-500 mb-1">Project Path</div>
              <div className="text-xs text-gray-400 font-mono truncate" title={projectPath}>
                {projectPath || 'Loading...'}
              </div>
            </div>
          </div>

          {/* Right content - File Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* File list */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border overflow-x-auto">
              {previewFiles.map((file, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedFile(file)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                    selectedFile === file
                      ? 'bg-surface-hover text-white'
                      : 'text-gray-400 hover:text-white hover:bg-surface-hover/50'
                  )}
                >
                  {getFileIcon(file.type)}
                  <span>{file.path.split('/').pop()}</span>
                </button>
              ))}
              {previewFiles.length === 0 && (
                <span className="text-sm text-gray-500">No files to export</span>
              )}
            </div>

            {/* File content preview */}
            <div className="flex-1 overflow-auto p-4">
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 font-mono">{selectedFile.path}</div>
                  <pre className="text-sm text-gray-300 font-mono bg-canvas p-4 rounded-lg overflow-auto max-h-[400px]">
                    {selectedFile.content}
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Select a file to preview
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <div className="flex items-center gap-2">
            {saveResult && saveResult.success && (
              <div className="flex items-center gap-2 text-status-completed text-sm">
                <Check className="w-4 h-4" />
                <span>Saved successfully!</span>
              </div>
            )}
            {saveResult && !saveResult.success && (
              <div className="flex items-center gap-2 text-status-error text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Some files failed to save</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-status-error text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || previewFiles.length === 0 || !hasContent}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isSaving || previewFiles.length === 0 || !hasContent
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover text-white'
              )}
            >
              <Download className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
