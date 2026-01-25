import { MessageSquare, Sparkles, BarChart3, Zap, Anchor } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { nanoid } from 'nanoid';
import { syncNode } from '../../services/syncService';
import type { WorkflowNode, InputNodeData, AgentNodeData, SkillNodeData, HookNodeData, OutputNodeData } from '../../types/nodes';

interface PaletteItem {
  type: 'input' | 'agent' | 'skill' | 'hook' | 'output';
  label: string;
  icon: React.ReactNode;
  color: string;
  hoverColor: string;
}

const paletteItems: PaletteItem[] = [
  {
    type: 'input',
    label: 'User Input',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-yellow-400',
    hoverColor: 'hover:bg-yellow-500/10',
  },
  {
    type: 'agent',
    label: 'Agent',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'text-purple-400',
    hoverColor: 'hover:bg-purple-500/10',
  },
  {
    type: 'skill',
    label: 'Skill',
    icon: <Zap className="w-4 h-4" />,
    color: 'text-cyan-400',
    hoverColor: 'hover:bg-cyan-500/10',
  },
  {
    type: 'hook',
    label: 'Hook',
    icon: <Anchor className="w-4 h-4" />,
    color: 'text-pink-400',
    hoverColor: 'hover:bg-pink-500/10',
  },
  {
    type: 'output',
    label: 'Output',
    icon: <BarChart3 className="w-4 h-4" />,
    color: 'text-emerald-400',
    hoverColor: 'hover:bg-emerald-500/10',
  },
];

function createDefaultNodeData(type: PaletteItem['type']): WorkflowNode {
  const id = nanoid();
  const position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };

  switch (type) {
    case 'input':
      return {
        id,
        type: 'input',
        position,
        data: {
          label: 'User Input',
          description: 'Enter your input here...',
          inputType: 'text',
          status: 'idle',
          placeholder: 'Enter your prompt...',
        } as InputNodeData,
      };
    case 'agent':
      return {
        id,
        type: 'agent',
        position,
        data: {
          label: 'Agent',
          description: 'Conduct in-depth research...',
          role: 'researcher',
          tools: ['WebSearch', 'WebFetch', 'Read'],
          status: 'idle',
          usedInputs: [],
        } as AgentNodeData,
      };
    case 'skill':
      return {
        id,
        type: 'skill',
        position,
        data: {
          label: 'Skill',
          description: 'Apply a specialized skill...',
          skillType: 'official',
          status: 'idle',
          usedInputs: [],
        } as SkillNodeData,
      };
    case 'hook':
      return {
        id,
        type: 'hook',
        position,
        data: {
          label: 'Hook',
          description: 'Configure tool lifecycle hook...',
          hookEvent: 'PreToolUse',
          status: 'idle',
          usedInputs: [],
        } as HookNodeData,
      };
    case 'output':
      return {
        id,
        type: 'output',
        position,
        data: {
          label: 'Output',
          description: 'Select to edit in editor',
          outputType: 'auto',
          status: 'idle',
          usedInputs: [],
        } as OutputNodeData,
      };
  }
}

export default function NodePalette() {
  const addNode = useWorkflowStore((state) => state.addNode);

  const handleAddNode = (type: PaletteItem['type']) => {
    const node = createDefaultNodeData(type);
    addNode(node);

    // Sync node to filesystem (input/output nodes are skipped in syncNode)
    syncNode(node).catch(err => {
      console.error('Failed to sync node to filesystem:', err);
    });
  };

  return (
    <div className="flex items-center justify-center gap-2 py-3 bg-canvas border-b border-border">
      {paletteItems.map((item) => (
        <button
          key={item.type}
          onClick={() => handleAddNode(item.type)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg
            bg-surface border border-border
            ${item.hoverColor}
            transition-all duration-200
            hover:border-gray-500
          `}
        >
          <span className={item.color}>{item.icon}</span>
          <span className="text-sm font-medium text-gray-300">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
