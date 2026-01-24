import { memo, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { NodeStatus } from '../../types/nodes';
import clsx from 'clsx';

interface BaseNodeProps {
  data: {
    label: string;
    description?: string;
    status: NodeStatus;
    progress?: number;
    error?: string;
    usedInputs?: string[];
    [key: string]: unknown;
  };
  selected?: boolean;
  children?: ReactNode;
  headerIcon?: ReactNode;
  headerColor?: string;
  bgColor?: string;
  borderColor?: string;
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;
  dark?: boolean;
}

function StatusIcon({ status }: { status: NodeStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Play className="w-4 h-4" />;
  }
}

function BaseNode({
  data,
  selected,
  children,
  headerIcon,
  headerColor = 'bg-gray-700',
  bgColor = 'bg-surface',
  borderColor = 'border-gray-600',
  showSourceHandle = true,
  showTargetHandle = true,
  dark = true,
}: BaseNodeProps) {
  const textColor = dark ? 'text-white' : 'text-gray-900';
  const descColor = dark ? 'text-gray-400' : 'text-gray-600';

  return (
    <div
      className={clsx(
        'workflow-node',
        bgColor,
        borderColor,
        'border-2 rounded-xl overflow-hidden',
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas',
        data.status === 'running' && 'animate-pulse-border'
      )}
    >
      {/* Header */}
      <div className={clsx('flex items-center justify-between px-3 py-2', headerColor)}>
        <div className="flex items-center gap-2">
          {headerIcon}
          <span className={clsx('font-medium text-sm', textColor)}>{data.label}</span>
        </div>
        <button className="p-1 hover:bg-white/10 rounded transition-colors">
          <StatusIcon status={data.status} />
        </button>
      </div>

      {/* Content */}
      <div className="px-3 py-3">
        {data.description && (
          <p className={clsx('text-sm mb-2', descColor)}>{data.description}</p>
        )}

        {children}

        {/* Used Inputs */}
        {data.usedInputs && data.usedInputs.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-700">
            <p className="text-xs text-gray-500 mb-1">Used in this step</p>
            <div className="flex flex-wrap gap-1">
              {data.usedInputs.map((inputId) => (
                <span
                  key={inputId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-800 border border-gray-700"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  {inputId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Handles */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-gray-500 !border-white"
        />
      )}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-gray-500 !border-white"
        />
      )}
    </div>
  );
}

export default memo(BaseNode);
