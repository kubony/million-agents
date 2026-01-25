import { useEffect, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Header from '../layout/Header';
import NodePalette from '../layout/NodePalette';
import FlowCanvas from '../canvas/FlowCanvas';
import RightSidebar from '../layout/RightSidebar';
import PromptBar from '../layout/PromptBar';
import BottomConsolePanel from '../layout/BottomConsolePanel';
import { usePanelStore } from '../../stores/panelStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useProjectStore } from '../../stores/projectStore';
import { loadClaudeConfig } from '../../services/configLoader';

export default function WorkflowBuilder() {
  const { isCollapsed, width } = usePanelStore();
  const { mergeExistingConfig, clearWorkflow } = useWorkflowStore();
  const { currentProject, navigateToPath } = useProjectStore();
  const initialLoadDone = useRef(false);
  const lastProjectPath = useRef<string | null>(null);

  // Navigate file explorer to project path on mount
  useEffect(() => {
    if (currentProject?.path) {
      navigateToPath(currentProject.path);
    }
  }, [currentProject?.path, navigateToPath]);

  // Load .claude/ config when project changes
  useEffect(() => {
    if (!currentProject?.path) return;

    // 프로젝트가 바뀌었는지 확인
    const projectChanged = lastProjectPath.current !== currentProject.path;

    if (projectChanged) {
      // 프로젝트가 바뀌면 기존 워크플로우 클리어
      clearWorkflow();
      lastProjectPath.current = currentProject.path;
      initialLoadDone.current = false;
    }

    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    loadClaudeConfig(currentProject.path).then((nodes) => {
      if (nodes.length > 0) {
        console.log(`Loaded ${nodes.length} nodes from ${currentProject.path}/.claude/`);
        mergeExistingConfig(nodes);
      }
    }).catch((err) => {
      console.error('Failed to load initial config:', err);
    });
  }, [currentProject?.path, mergeExistingConfig, clearWorkflow]);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-canvas overflow-hidden">
        {/* Header */}
        <Header />

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Node Palette */}
            <NodePalette />

            {/* Flow Canvas */}
            <div className="flex-1 relative min-h-0">
              <FlowCanvas />

              {/* Prompt Bar (Floating) */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
                <PromptBar />
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          {!isCollapsed && (
            <div
              className="border-l border-border bg-surface flex-shrink-0"
              style={{ width: `${width}px` }}
            >
              <RightSidebar />
            </div>
          )}
        </div>

        {/* Bottom Console Panel */}
        <BottomConsolePanel />
      </div>
    </ReactFlowProvider>
  );
}
