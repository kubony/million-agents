import { useState, useRef, useEffect } from 'react';
import { Terminal, ChevronDown, ChevronUp, Trash2, Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { useExecutionStore } from '../../stores/executionStore';
import clsx from 'clsx';

interface BottomConsolePanelProps {
  className?: string;
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

function LogIcon({ level }: { level: string }) {
  switch (level) {
    case 'success':
      return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'warning':
      return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
    default:
      return <Info className="w-3.5 h-3.5 text-blue-400" />;
  }
}

export default function BottomConsolePanel({ className = '' }: BottomConsolePanelProps) {
  const { logs, clearLogs, isRunning } = useExecutionStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  return (
    <div className={`border-t border-border bg-surface flex-shrink-0 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:text-white transition-colors"
        >
          <Terminal className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-gray-300">Console</span>
          {isRunning && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              Running
            </span>
          )}
          {logs.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
              {logs.length}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {logs.length > 0 && (
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-surface-hover rounded transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4 text-gray-500 hover:text-gray-300" />
          </button>
        )}
      </div>

      {/* Log content */}
      {isExpanded && (
        <div
          ref={scrollRef}
          className="h-32 overflow-y-auto font-mono text-xs p-2 space-y-0.5"
        >
          {logs.length === 0 ? (
            <div className="text-gray-600 py-4 text-center">
              No logs yet. Run workflow to see output.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={clsx(
                  'flex items-start gap-2 px-2 py-1 rounded',
                  log.level === 'error' && 'bg-red-500/10',
                  log.level === 'warning' && 'bg-yellow-500/10',
                  log.level === 'success' && 'bg-green-500/10'
                )}
              >
                <span className="text-gray-600 flex-shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <LogIcon level={log.level} />
                <span
                  className={clsx(
                    'break-all',
                    log.level === 'error' && 'text-red-400',
                    log.level === 'warning' && 'text-yellow-400',
                    log.level === 'success' && 'text-green-400',
                    log.level === 'info' && 'text-gray-300'
                  )}
                >
                  {log.message}
                </span>
                {log.nodeId && (
                  <span className="text-purple-400 flex-shrink-0">
                    [{log.nodeId.slice(0, 8)}]
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
