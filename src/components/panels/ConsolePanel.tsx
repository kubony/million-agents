import { useState, useEffect, useRef } from 'react';
import { Trash2, Info, AlertTriangle, XCircle, CheckCircle, Terminal, X, Minimize2, Maximize2, ChevronUp, ChevronDown } from 'lucide-react';
import { useExecutionStore } from '../../stores/executionStore';
import type { LogLevel } from '../../types/workflow';
import clsx from 'clsx';

interface ConsolePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function LogIcon({ level }: { level: LogLevel }) {
  switch (level) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    default:
      return <Info className="w-4 h-4 text-blue-400" />;
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function ConsolePanel({ isOpen, onClose }: ConsolePanelProps) {
  const { logs, clearLogs, isRunning } = useExecutionStore();
  const [isMinimized, setIsMinimized] = useState(false);
  const [height, setHeight] = useState(250);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current && !isMinimized) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isMinimized]);

  // Resize handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(Math.max(startHeight + delta, 100), 500);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-gray-700 z-50 shadow-2xl"
      style={{ height: isMinimized ? 40 : height }}
    >
      {/* Resize Handle */}
      {!isMinimized && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-amber-500 transition-colors"
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252525] border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-white">Console</span>
          {isRunning && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              Running
            </span>
          )}
          <span className="text-xs text-gray-500">({logs.length} logs)</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={clearLogs}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={() => setHeight(height === 250 ? 400 : 250)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Toggle size"
          >
            {height > 250 ? (
              <Minimize2 className="w-4 h-4 text-gray-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div
          className="overflow-y-auto font-mono text-sm p-3"
          style={{ height: height - 44 }}
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>No logs yet. Run the workflow to see output.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={clsx(
                    'flex items-start gap-2 px-2 py-1 rounded hover:bg-gray-800/50',
                    log.level === 'error' && 'bg-red-500/10',
                    log.level === 'warning' && 'bg-yellow-500/10',
                    log.level === 'success' && 'bg-green-500/10'
                  )}
                >
                  <span className="text-gray-600 shrink-0 text-xs">
                    [{formatTime(log.timestamp)}]
                  </span>
                  <LogIcon level={log.level} />
                  <div className="flex-1 min-w-0">
                    <span
                      className={clsx(
                        'text-xs',
                        log.level === 'error' && 'text-red-400',
                        log.level === 'warning' && 'text-yellow-400',
                        log.level === 'success' && 'text-green-400',
                        log.level === 'info' && 'text-gray-300'
                      )}
                    >
                      {log.message}
                    </span>
                    {log.nodeId && (
                      <span className="ml-2 text-purple-400 text-xs">
                        [{log.nodeId.slice(0, 8)}]
                      </span>
                    )}
                    {log.details && (
                      <pre className="mt-1 p-2 bg-black/30 rounded text-xs text-gray-400 overflow-x-auto">
                        {typeof log.details === 'string'
                          ? log.details
                          : JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
