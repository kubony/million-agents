import { memo } from 'react';
import { Terminal } from 'lucide-react';
import BaseNode from './BaseNode';
import type { CommandNodeData } from '../../types/nodes';

interface CommandNodeProps {
  data: CommandNodeData;
  selected: boolean;
}

function CommandNode({ data, selected }: CommandNodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerIcon={<Terminal className="w-4 h-4 text-orange-100" />}
      headerColor="bg-gradient-to-br from-orange-500 to-orange-700"
      showTargetHandle={true}
      showSourceHandle={true}
    >
      <div className="space-y-2">
        {data.commandName && (
          <span className="inline-block px-2 py-0.5 text-xs bg-orange-900/50 text-orange-300 rounded">
            /{data.commandName}
          </span>
        )}
        {data.commandPath && (
          <div className="text-xs text-gray-500 truncate">
            {data.commandPath}
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export default memo(CommandNode);
