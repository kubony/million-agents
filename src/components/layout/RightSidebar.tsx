import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Settings2 } from 'lucide-react';
import { useWorkflowStore, selectSelectedNode } from '../../stores/workflowStore';
import FileExplorer from './FileExplorer';
import PropertiesPanel from '../panels/PropertiesPanel';

type TabType = 'explorer' | 'properties';

interface RightSidebarProps {
  showProperties?: boolean;
}

export default function RightSidebar({ showProperties = true }: RightSidebarProps) {
  const selectedNode = useWorkflowStore(selectSelectedNode);
  const [activeTab, setActiveTab] = useState<TabType>('explorer');
  const prevSelectedNode = useRef(selectedNode);

  // Auto-switch to properties tab when a node is selected
  useEffect(() => {
    if (showProperties && selectedNode && selectedNode !== prevSelectedNode.current) {
      setActiveTab('properties');
    }
    prevSelectedNode.current = selectedNode;
  }, [selectedNode, showProperties]);

  // If showProperties is false, only show Explorer (no tabs)
  if (!showProperties) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-3 py-2 border-b border-border">
          <FolderOpen className="w-4 h-4 text-amber-500 mr-2" />
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Explorer
          </span>
        </div>
        <FileExplorer className="flex-1 min-h-0" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex border-b border-border flex-shrink-0">
        <button
          onClick={() => setActiveTab('explorer')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
            activeTab === 'explorer'
              ? 'text-white border-b-2 border-amber-500 bg-surface-hover'
              : 'text-gray-500 hover:text-gray-300 hover:bg-surface-hover'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          Explorer
        </button>
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
            activeTab === 'properties'
              ? 'text-white border-b-2 border-amber-500 bg-surface-hover'
              : 'text-gray-500 hover:text-gray-300 hover:bg-surface-hover'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          Properties
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'explorer' ? (
          <FileExplorer className="h-full" />
        ) : (
          <div className="h-full overflow-y-auto">
            <PropertiesPanel node={selectedNode} />
          </div>
        )}
      </div>
    </div>
  );
}
