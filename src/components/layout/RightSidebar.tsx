import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useWorkflowStore, selectSelectedNode } from '../../stores/workflowStore';
import FileExplorer from './FileExplorer';
import PropertiesPanel from '../panels/PropertiesPanel';

interface RightSidebarProps {
  showProperties?: boolean;
}

export default function RightSidebar({ showProperties = true }: RightSidebarProps) {
  const selectedNode = useWorkflowStore(selectSelectedNode);
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* File Explorer Section */}
      <div className={`flex flex-col transition-all ${
        showProperties
          ? (isExplorerCollapsed ? 'h-10' : 'flex-1 min-h-[200px]')
          : 'flex-1'
      } ${showProperties ? 'border-b border-border' : ''}`}>
        {/* Explorer Header with Toggle */}
        <button
          onClick={() => setIsExplorerCollapsed(!isExplorerCollapsed)}
          className="flex items-center justify-between px-3 py-2 hover:bg-surface-hover transition-colors flex-shrink-0"
          disabled={!showProperties}
        >
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Explorer
          </span>
          {showProperties && (
            isExplorerCollapsed ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            )
          )}
        </button>

        {/* File Explorer Content */}
        {(!showProperties || !isExplorerCollapsed) && (
          <FileExplorer className="flex-1 min-h-0" />
        )}
      </div>

      {/* Properties Section - only shown when showProperties is true */}
      {showProperties && (
        <div className={`flex flex-col transition-all ${
          isExplorerCollapsed ? 'flex-1' : 'h-[45%]'
        }`}>
          {/* Properties Header */}
          <div className="flex items-center px-3 py-2 border-b border-border flex-shrink-0">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Properties
            </span>
          </div>

          {/* Properties Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <PropertiesPanel node={selectedNode} />
          </div>
        </div>
      )}
    </div>
  );
}
