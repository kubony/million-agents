import { memo } from 'react';
import { Zap } from 'lucide-react';
import BaseNode from './BaseNode';
import type { SkillNodeData } from '../../types/nodes';

interface SkillNodeProps {
  data: SkillNodeData;
  selected: boolean;
}

function SkillNode({ data, selected }: SkillNodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerIcon={<Zap className="w-4 h-4 text-cyan-200" />}
      headerColor="bg-cyan-600"
      showTargetHandle={true}
      showSourceHandle={true}
    >
      <div className="space-y-2">
        {data.skillType === 'official' && data.skillId && (
          <span className="inline-block px-2 py-0.5 text-xs bg-cyan-900/50 text-cyan-300 rounded">
            {data.skillId}
          </span>
        )}
        {data.skillCategory && (
          <div className="text-xs text-gray-500">
            Category: {data.skillCategory}
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export default memo(SkillNode);
