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
      headerIcon={<MessageSquare className="w-4 h-4 text-yellow-600" />}
      headerColor="bg-node-input"
      bgColor="bg-node-input"
      borderColor="border-node-input-border"
      showTargetHandle={false}
      showSourceHandle={true}
      dark={false}
    >
      <div className="text-gray-700">
        {data.inputType === 'text' && (
          <div className="text-sm text-gray-600">
            {data.value || data.placeholder || 'Enter your input...'}
          </div>
        )}
        {data.inputType === 'file' && (
          <div className="text-sm text-gray-600">
            Drop files here or click to upload
          </div>
        )}
        {data.inputType === 'select' && data.options && (
          <select className="w-full px-2 py-1 text-sm bg-white border border-yellow-300 rounded">
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
