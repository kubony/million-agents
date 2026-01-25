import { memo } from 'react';
import { Anchor } from 'lucide-react';
import BaseNode from './BaseNode';
import type { HookNodeData } from '../../types/nodes';

interface HookNodeProps {
  data: HookNodeData;
  selected: boolean;
}

function HookNode({ data, selected }: HookNodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerIcon={<Anchor className="w-4 h-4 text-pink-100" />}
      headerColor="bg-gradient-to-br from-pink-500 to-rose-700"
      showTargetHandle={true}
      showSourceHandle={true}
    >
      <div className="space-y-2">
        {data.hookEvent && (
          <span className="inline-block px-2 py-0.5 text-xs bg-pink-900/50 text-pink-300 rounded">
            {data.hookEvent}
          </span>
        )}
        {data.hookMatcher && (
          <div className="text-xs text-gray-500 truncate">
            {data.hookMatcher}
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export default memo(HookNode);
