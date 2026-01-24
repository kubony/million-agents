import { Trash2, Sparkles, MessageSquare, Zap, Plug, BarChart3 } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import type { WorkflowNode, SubagentNodeData } from '../../types/nodes';
import { AVAILABLE_TOOLS } from '../../types/nodes';

interface StepPanelProps {
  node: WorkflowNode | undefined;
}

// Model options (similar to Opal's Gemini models)
const MODEL_OPTIONS = [
  { id: 'sonnet', name: 'Claude 3.5 Sonnet', description: 'Fast, cost-efficient' },
  { id: 'opus', name: 'Claude 3 Opus', description: 'Best for complex tasks' },
  { id: 'haiku', name: 'Claude 3 Haiku', description: 'Fastest, for simple tasks' },
];

function getNodeIcon(type: string | undefined) {
  switch (type) {
    case 'input':
      return <MessageSquare className="w-5 h-5 text-yellow-400" />;
    case 'subagent':
      return <Sparkles className="w-5 h-5 text-purple-400" />;
    case 'skill':
      return <Zap className="w-5 h-5 text-cyan-400" />;
    case 'mcp':
      return <Plug className="w-5 h-5 text-pink-400" />;
    case 'output':
      return <BarChart3 className="w-5 h-5 text-emerald-400" />;
    default:
      return null;
  }
}

export default function StepPanel({ node }: StepPanelProps) {
  const { updateNode, removeNode } = useWorkflowStore();

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Select a node to configure</p>
      </div>
    );
  }

  const handleDelete = () => {
    removeNode(node.id);
  };

  const handleLabelChange = (label: string) => {
    updateNode(node.id, { label });
  };

  const handleDescriptionChange = (description: string) => {
    updateNode(node.id, { description });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {getNodeIcon(node.type)}
          <h3 className="text-lg font-semibold text-white">{node.data.label}</h3>
        </div>
        <button
          onClick={handleDelete}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Name
          </label>
          <input
            type="text"
            value={node.data.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Description
          </label>
          <textarea
            value={node.data.description || ''}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>

        {/* Type-specific settings */}
        {node.type === 'subagent' && (
          <SubagentSettings
            data={node.data as SubagentNodeData}
            onUpdate={(data) => updateNode(node.id, data)}
          />
        )}

        {node.type === 'output' && (
          <OutputSettings
            onUpdate={(data) => updateNode(node.id, data)}
          />
        )}
      </div>
    </div>
  );
}

// Subagent-specific settings
function SubagentSettings({
  data,
  onUpdate,
}: {
  data: SubagentNodeData;
  onUpdate: (data: Partial<SubagentNodeData>) => void;
}) {
  return (
    <>
      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Model
        </label>
        <div className="space-y-2">
          {MODEL_OPTIONS.map((model) => (
            <button
              key={model.id}
              onClick={() => onUpdate({ model: model.id as SubagentNodeData['model'] })}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                data.model === model.id
                  ? 'bg-accent/20 border-accent'
                  : 'bg-surface-hover border-border hover:border-gray-500'
              }`}
            >
              <Sparkles className="w-5 h-5 text-purple-400" />
              <div className="text-left">
                <div className="font-medium text-white">{model.name}</div>
                <div className="text-xs text-gray-500">{model.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Allowed Tools
        </label>
        <div className="grid grid-cols-2 gap-2">
          {AVAILABLE_TOOLS.map((tool) => (
            <label
              key={tool}
              className="flex items-center gap-2 p-2 bg-surface-hover rounded-lg cursor-pointer hover:bg-border transition-colors"
            >
              <input
                type="checkbox"
                checked={data.tools?.includes(tool) ?? false}
                onChange={(e) => {
                  const newTools = e.target.checked
                    ? [...(data.tools || []), tool]
                    : (data.tools || []).filter((t) => t !== tool);
                  onUpdate({ tools: newTools });
                }}
                className="rounded border-gray-600 bg-surface text-accent focus:ring-accent"
              />
              <span className="text-sm text-gray-300">{tool}</span>
            </label>
          ))}
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          System Prompt
        </label>
        <textarea
          value={data.systemPrompt || ''}
          onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
          rows={4}
          placeholder="Enter custom instructions for this agent..."
          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
      </div>
    </>
  );
}

// Output-specific settings
function OutputSettings({
  onUpdate,
}: {
  onUpdate: (data: any) => void;
}) {
  const layoutOptions = [
    { id: 'manual', name: 'Manual layout', description: 'Content is displayed exactly as typed' },
    { id: 'auto', name: 'Webpage with auto-layout', description: 'Layout automatically generated' },
    { id: 'google-docs', name: 'Save to Google Docs', description: 'Save content to a Google Document' },
    { id: 'google-slides', name: 'Save to Google Slides', description: 'Save content as a Google Drive Presentation' },
    { id: 'google-sheets', name: 'Save to Google Sheets', description: 'Save content as a Google Drive Spreadsheet' },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">
        Output Format
      </label>
      <div className="space-y-2">
        {layoutOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => onUpdate({ layoutType: option.id })}
            className="w-full flex items-center gap-3 p-3 rounded-lg border bg-surface-hover border-border hover:border-gray-500 transition-colors text-left"
          >
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="font-medium text-white">{option.name}</div>
              <div className="text-xs text-gray-500">{option.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
