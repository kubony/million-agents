import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import BaseNode from './BaseNode';
import type { SubagentNodeData } from '../../types/nodes';

interface SubagentNodeProps {
  data: SubagentNodeData;
  selected: boolean;
}

function SubagentNode({ data, selected }: SubagentNodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerIcon={<Sparkles className="w-4 h-4 text-indigo-200" />}
      headerColor="bg-indigo-600"
      showTargetHandle={true}
      showSourceHandle={true}
    >
      <div className="space-y-2">
        {/* Tools badges */}
        {data.tools && data.tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.tools.slice(0, 3).map((tool) => (
              <span
                key={tool}
                className="px-2 py-0.5 text-xs bg-purple-900/50 text-purple-300 rounded"
              >
                {tool}
              </span>
            ))}
            {data.tools.length > 3 && (
              <span className="px-2 py-0.5 text-xs bg-purple-900/50 text-purple-300 rounded">
                +{data.tools.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Model indicator */}
        {data.model && (
          <div className="text-xs text-gray-500">
            Model: {data.model}
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export default memo(SubagentNode);
