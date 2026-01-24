import { Trash2, Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import { useExecutionStore } from '../../stores/executionStore';
import type { LogLevel } from '../../types/workflow';
import clsx from 'clsx';

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

export default function ConsolePanel() {
  const { logs, clearLogs } = useExecutionStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-white">Console</h3>
        <button
          onClick={clearLogs}
          className="p-2 text-gray-400 hover:text-white hover:bg-surface-hover rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No logs yet. Run the workflow to see output.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className={clsx(
                  'flex items-start gap-2 p-2 rounded',
                  log.level === 'error' && 'bg-red-500/10',
                  log.level === 'warning' && 'bg-yellow-500/10',
                  log.level === 'success' && 'bg-green-500/10'
                )}
              >
                <span className="text-gray-500 shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <LogIcon level={log.level} />
                <div className="flex-1">
                  <span
                    className={clsx(
                      log.level === 'error' && 'text-red-400',
                      log.level === 'warning' && 'text-yellow-400',
                      log.level === 'success' && 'text-green-400',
                      log.level === 'info' && 'text-gray-300'
                    )}
                  >
                    {log.message}
                  </span>
                  {log.nodeId && (
                    <span className="ml-2 text-gray-500">
                      (Node: {log.nodeId})
                    </span>
                  )}
                  {log.details && (
                    <pre className="mt-1 p-2 bg-surface rounded text-xs text-gray-400 overflow-x-auto">
                      {typeof log.details === 'string'
                        ? log.details
                        : JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
