import { useState, useEffect, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Terminal } from 'lucide-react';
import Header from '../layout/Header';
import NodePalette from '../layout/NodePalette';
import FlowCanvas from '../canvas/FlowCanvas';
import RightPanel from '../layout/RightPanel';
import PromptBar from '../layout/PromptBar';
import { FloatingConsolePanel } from '../panels/ConsolePanel';
import { usePanelStore } from '../../stores/panelStore';
import { useExecutionStore } from '../../stores/executionStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { loadClaudeConfig } from '../../services/configLoader';

export default function WorkflowBuilder() {
  const { isCollapsed, width } = usePanelStore();
  const { isRunning, logs } = useExecutionStore();
  const { mergeExistingConfig } = useWorkflowStore();
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const initialLoadDone = useRef(false);

  // Auto-load existing .claude/ config on startup
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    loadClaudeConfig().then((nodes) => {
      if (nodes.length > 0) {
        console.log(`Loaded ${nodes.length} nodes from .claude/`);
        mergeExistingConfig(nodes);
      }
    }).catch((err) => {
      console.error('Failed to load initial config:', err);
    });
  }, [mergeExistingConfig]);

  // Auto-open console when workflow starts running
  useEffect(() => {
    if (isRunning) {
      setIsConsoleOpen(true);
    }
  }, [isRunning]);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-canvas">
        {/* Header */}
        <Header />

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas Area */}
          <div className="flex-1 flex flex-col">
            {/* Node Palette */}
            <NodePalette />

            {/* Flow Canvas */}
            <div className="flex-1 relative">
              <FlowCanvas />

              {/* Prompt Bar (Floating) */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
                <PromptBar />
              </div>
            </div>
          </div>

          {/* Right Panel */}
          {!isCollapsed && (
            <div
              className="border-l border-border bg-surface"
              style={{ width: `${width}px` }}
            >
              <RightPanel />
            </div>
          )}
        </div>

        {/* Console Toggle Button */}
        <button
          onClick={() => setIsConsoleOpen(!isConsoleOpen)}
          className={`fixed bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg transition-all ${
            isConsoleOpen
              ? 'bg-amber-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          } ${isConsoleOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <Terminal className="w-4 h-4" />
          <span className="text-sm font-medium">Console</span>
          {logs.length > 0 && !isConsoleOpen && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
              {logs.length}
            </span>
          )}
          {isRunning && (
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          )}
        </button>

        {/* Console Panel */}
        <FloatingConsolePanel isOpen={isConsoleOpen} onClose={() => setIsConsoleOpen(false)} />
      </div>
    </ReactFlowProvider>
  );
}
