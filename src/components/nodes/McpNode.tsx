import { memo } from 'react';
import { Plug } from 'lucide-react';
import BaseNode from './BaseNode';
import type { McpNodeData } from '../../types/nodes';

interface McpNodeProps {
  data: McpNodeData;
  selected: boolean;
}

function McpNode({ data, selected }: McpNodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerIcon={<Plug className="w-4 h-4 text-pink-100" />}
      headerColor="bg-gradient-to-br from-pink-500 to-rose-700"
      showTargetHandle={true}
      showSourceHandle={true}
    >
      <div className="space-y-2">
        {data.serverName && (
          <span className="inline-block px-2 py-0.5 text-xs bg-pink-900/50 text-pink-300 rounded">
            {data.serverName}
          </span>
        )}
        <div className="text-xs text-gray-500">
          Type: {data.serverType}
        </div>
      </div>
    </BaseNode>
  );
}

export default memo(McpNode);
