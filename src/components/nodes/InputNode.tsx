import { memo } from 'react';
import { MessageSquare } from 'lucide-react';
import BaseNode from './BaseNode';
import type { InputNodeData } from '../../types/nodes';

interface InputNodeProps {
  data: InputNodeData;
  selected: boolean;
}

function InputNode({ data, selected }: InputNodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerIcon={<MessageSquare className="w-4 h-4 text-amber-200" />}
      headerColor="bg-amber-600"
      showTargetHandle={false}
      showSourceHandle={true}
    >
      <div className="text-gray-300">
        {data.inputType === 'text' && (
          <div className="text-sm text-gray-400">
            {data.value || data.placeholder || 'Enter your input...'}
          </div>
        )}
        {data.inputType === 'file' && (
          <div className="text-sm text-gray-400">
            Drop files here or click to upload
          </div>
        )}
        {data.inputType === 'select' && data.options && (
          <select className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-300">
            {data.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
      </div>
    </BaseNode>
  );
}

export default memo(InputNode);
