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
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;
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
  showSourceHandle = true,
  showTargetHandle = true,
}: BaseNodeProps) {
  // 상태에 따른 테두리 색상
  const getStatusBorderClass = () => {
    switch (data.status) {
      case 'running':
        return 'border-indigo-500 animate-pulse-border';
      case 'completed':
        return 'border-green-500';
      case 'error':
        return 'border-red-500';
      default:
        return '';
    }
  };

  return (
    <div
      className={clsx(
        'workflow-node',
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas',
        getStatusBorderClass()
      )}
    >
      {/* Header - 컬러풀한 헤더 */}
      <div className={clsx(
        'node-header flex items-center justify-between',
        headerColor
      )}>
        <div className="flex items-center gap-2">
          {headerIcon}
          <span className="font-semibold text-sm text-white">{data.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <StatusIcon status={data.status} />
        </div>
      </div>

      {/* Content - 다크 배경 통일 */}
      <div className="node-content">
        {data.description && (
          <p className="text-sm text-gray-400 mb-3">{data.description}</p>
        )}

        {children}

        {/* Used Inputs */}
        {data.usedInputs && data.usedInputs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <p className="text-xs text-gray-500 mb-2">Used in this step</p>
            <div className="flex flex-wrap gap-1.5">
              {data.usedInputs.map((inputId) => (
                <span
                  key={inputId}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-gray-700/50 border border-gray-600 text-gray-300"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
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
        />
      )}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
        />
      )}
    </div>
  );
}

export default memo(BaseNode);
