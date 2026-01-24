import { usePanelStore } from '../../stores/panelStore';
import { useWorkflowStore, selectSelectedNode } from '../../stores/workflowStore';
import PreviewPanel from '../panels/PreviewPanel';
import ConsolePanel from '../panels/ConsolePanel';
import StepPanel from '../panels/StepPanel';
import type { PanelTab } from '../../types/workflow';
import clsx from 'clsx';

const tabs: { id: PanelTab; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'console', label: 'Console' },
  { id: 'step', label: 'Step' },
  { id: 'theme', label: 'Theme' },
];

export default function RightPanel() {
  const { activeTab, setActiveTab } = usePanelStore();
  const selectedNode = useWorkflowStore(selectSelectedNode);

  return (
    <div className="flex flex-col h-full">
      {/* Tab Headers */}
      <div className="flex items-center gap-1 p-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === tab.id
                ? 'bg-surface-hover text-white'
                : 'text-gray-400 hover:text-white hover:bg-surface-hover/50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'preview' && <PreviewPanel />}
        {activeTab === 'console' && <ConsolePanel />}
        {activeTab === 'step' && <StepPanel node={selectedNode} />}
        {activeTab === 'theme' && (
          <div className="p-4 text-gray-500">
            Theme customization coming soon...
          </div>
        )}
      </div>
    </div>
  );
}
