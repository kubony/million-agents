import { Trash2, Sparkles, MessageSquare, Zap, Plug, BarChart3, Settings2 } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import type { WorkflowNode, SubagentNodeData, InputNodeData, SkillNodeData, McpNodeData } from '../../types/nodes';
import { AVAILABLE_TOOLS } from '../../types/nodes';

interface StepPanelProps {
  node: WorkflowNode | undefined;
}

// Model options (similar to Opal's Gemini models)
const MODEL_OPTIONS = [
  { id: 'sonnet', name: 'Claude 4 Sonnet', description: 'Fast, cost-efficient' },
  { id: 'opus', name: 'Claude 4.5 Opus', description: 'Best for complex tasks' },
  { id: 'haiku', name: 'Claude 3.5 Haiku', description: 'Fastest, for simple tasks' },
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

function getNodeTypeName(type: string | undefined) {
  switch (type) {
    case 'input':
      return 'User Input';
    case 'subagent':
      return 'Sub Agent';
    case 'skill':
      return 'Skill';
    case 'mcp':
      return 'MCP Server';
    case 'output':
      return 'Output';
    default:
      return 'Node';
  }
}

export default function StepPanel({ node }: StepPanelProps) {
  const { updateNode, removeNode } = useWorkflowStore();

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
        <Settings2 className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-center">Select a node to configure its settings</p>
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
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface">
            {getNodeIcon(node.type)}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{node.data.label}</h3>
            <p className="text-xs text-gray-500">{getNodeTypeName(node.type)}</p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Delete node"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Name
          </label>
          <input
            type="text"
            value={node.data.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          />
        </div>

        {/* Description / Prompt */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            {node.type === 'subagent' ? 'Prompt' : 'Description'}
          </label>
          <textarea
            value={node.data.description || ''}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            rows={4}
            placeholder={node.type === 'subagent' ? 'Enter instructions for this agent...' : 'Describe what this step does...'}
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all resize-none"
          />
        </div>

        {/* Type-specific settings */}
        {node.type === 'input' && (
          <InputSettings
            data={node.data as InputNodeData}
            onUpdate={(data) => updateNode(node.id, data)}
          />
        )}

        {node.type === 'subagent' && (
          <SubagentSettings
            data={node.data as SubagentNodeData}
            onUpdate={(data) => updateNode(node.id, data)}
          />
        )}

        {node.type === 'skill' && (
          <SkillSettings
            data={node.data as SkillNodeData}
            onUpdate={(data) => updateNode(node.id, data)}
          />
        )}

        {node.type === 'mcp' && (
          <McpSettings
            data={node.data as McpNodeData}
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

// Input-specific settings
function InputSettings({
  data,
  onUpdate,
}: {
  data: InputNodeData;
  onUpdate: (data: Partial<InputNodeData>) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Input Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {['text', 'file', 'select'].map((type) => (
            <button
              key={type}
              onClick={() => onUpdate({ inputType: type as InputNodeData['inputType'] })}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                data.inputType === type
                  ? 'bg-accent/20 border-accent text-white'
                  : 'bg-surface border-border text-gray-400 hover:border-gray-500'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Default Value
        </label>
        <textarea
          value={data.value || ''}
          onChange={(e) => onUpdate({ value: e.target.value })}
          rows={3}
          placeholder="Enter default value..."
          className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
      </div>
    </>
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

// Skill-specific settings
function SkillSettings({
  data,
  onUpdate,
}: {
  data: SkillNodeData;
  onUpdate: (data: Partial<SkillNodeData>) => void;
}) {
  const skillOptions = [
    { id: 'ppt-generator', name: 'PPT Generator', description: 'Create PowerPoint presentations' },
    { id: 'image-gen-nanobanana', name: 'Image Generator', description: 'Generate images with AI' },
    { id: 'pdf', name: 'PDF Processor', description: 'Process and create PDF documents' },
    { id: 'xlsx', name: 'Excel Processor', description: 'Work with spreadsheets' },
    { id: 'docx', name: 'Word Processor', description: 'Create and edit documents' },
  ];

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Skill Type
        </label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {['official', 'custom'].map((type) => (
            <button
              key={type}
              onClick={() => onUpdate({ skillType: type as SkillNodeData['skillType'] })}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                data.skillType === type
                  ? 'bg-accent/20 border-accent text-white'
                  : 'bg-surface border-border text-gray-400 hover:border-gray-500'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Select Skill
        </label>
        <div className="space-y-2">
          {skillOptions.map((skill) => (
            <button
              key={skill.id}
              onClick={() => onUpdate({ skillId: skill.id })}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                data.skillId === skill.id
                  ? 'bg-accent/20 border-accent'
                  : 'bg-surface border-border hover:border-gray-500'
              }`}
            >
              <Zap className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="font-medium text-white">{skill.name}</div>
                <div className="text-xs text-gray-500">{skill.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// MCP-specific settings
function McpSettings({
  data,
  onUpdate,
}: {
  data: McpNodeData;
  onUpdate: (data: Partial<McpNodeData>) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Server Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {['stdio', 'sse'].map((type) => (
            <button
              key={type}
              onClick={() => onUpdate({ serverType: type as McpNodeData['serverType'] })}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                data.serverType === type
                  ? 'bg-accent/20 border-accent text-white'
                  : 'bg-surface border-border text-gray-400 hover:border-gray-500'
              }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Server Name
        </label>
        <input
          type="text"
          value={data.serverName || ''}
          onChange={(e) => onUpdate({ serverName: e.target.value })}
          placeholder="e.g., my-mcp-server"
          className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Server Command (for stdio)
        </label>
        <input
          type="text"
          value={(data.serverConfig as any)?.command || ''}
          onChange={(e) => onUpdate({ serverConfig: { ...data.serverConfig, command: e.target.value } })}
          placeholder="e.g., npx @anthropic/mcp-server"
          className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent"
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
    { id: 'auto', name: 'Auto Format', description: 'Automatically format output' },
    { id: 'markdown', name: 'Markdown', description: 'Plain markdown text' },
    { id: 'document', name: 'Document', description: 'Formatted document output' },
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
