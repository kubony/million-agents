import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
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
  const navigate = useNavigate();
  const { projectName } = useParams<{ projectName: string }>();
  const { isCollapsed, width, setWidth, toggleCollapsed } = usePanelStore();
  const isResizing = useRef(false);
  const { mergeExistingConfig, clearWorkflow } = useWorkflowStore();
  const { currentProject, navigateToPath, projects, fetchProjects, setCurrentProject } = useProjectStore();
  const initialLoadDone = useRef(false);
  const lastProjectPath = useRef<string | null>(null);
  const hadProject = useRef(false);
  const projectRestoredRef = useRef(false);

  // Restore project from URL on page refresh
  useEffect(() => {
    if (!projectName || projectRestoredRef.current) return;

    // If currentProject already matches URL, no need to restore
    if (currentProject?.name === decodeURIComponent(projectName)) {
      projectRestoredRef.current = true;
      return;
    }

    // If projects not loaded yet, fetch them
    if (projects.length === 0) {
      fetchProjects();
      return;
    }

    // Find project by name from URL
    const decodedName = decodeURIComponent(projectName);
    const project = projects.find((p) => p.name === decodedName);

    if (project) {
      setCurrentProject(project);
      projectRestoredRef.current = true;
    } else {
      // Project not found, redirect to home
      console.warn(`Project "${decodedName}" not found, redirecting to home`);
      navigate('/');
    }
  }, [projectName, projects, currentProject, fetchProjects, setCurrentProject, navigate]);

  // Navigate file explorer to project path on mount
  useEffect(() => {
    if (currentProject?.path) {
      navigateToPath(currentProject.path);
      hadProject.current = true;
    }
  }, [currentProject?.path, navigateToPath]);

  // Navigate to home when currentProject becomes null (e.g., Explorer home button)
  useEffect(() => {
    if (!currentProject && hadProject.current) {
      navigate('/');
    }
  }, [currentProject, navigate]);

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

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    setWidth(newWidth);
  }, [setWidth]);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Attach global mouse events for resize
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

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

          {/* Right Sidebar with Resize Handle */}
          <div className="relative flex flex-shrink-0">
            {/* Toggle Button (shown when collapsed) */}
            {isCollapsed && (
              <button
                onClick={toggleCollapsed}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-surface hover:bg-surface-hover border border-border rounded-l-md text-gray-400 hover:text-white transition-colors"
                title="Explorer 열기"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>
            )}

            {/* Sidebar Content */}
            {!isCollapsed && (
              <>
                {/* Resize Handle */}
                <div
                  onMouseDown={handleMouseDown}
                  className="w-1 cursor-col-resize hover:bg-amber-500/50 active:bg-amber-500 transition-colors flex-shrink-0"
                  title="드래그하여 크기 조정"
                />

                {/* Sidebar */}
                <div
                  className="border-l border-border bg-surface flex flex-col"
                  style={{ width: `${width}px` }}
                >
                  {/* Collapse Button in Header */}
                  <div className="flex items-center justify-end px-2 py-1 border-b border-border">
                    <button
                      onClick={toggleCollapsed}
                      className="p-1 text-gray-400 hover:text-white hover:bg-surface-hover rounded transition-colors"
                      title="Explorer 닫기"
                    >
                      <PanelRightClose className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <RightSidebar />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom Console Panel */}
        <BottomConsolePanel />
      </div>
    </ReactFlowProvider>
  );
}
