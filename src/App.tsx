import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Header from './components/layout/Header';
import NodePalette from './components/layout/NodePalette';
import FlowCanvas from './components/canvas/FlowCanvas';
import RightPanel from './components/layout/RightPanel';
import PromptBar from './components/layout/PromptBar';
import { usePanelStore } from './stores/panelStore';

function App() {
  const { isCollapsed, width } = usePanelStore();

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
      </div>
    </ReactFlowProvider>
  );
}

export default App;
