import { memo } from 'react';
import { BarChart3, FileText, Image, Globe, Link2 } from 'lucide-react';
import BaseNode from './BaseNode';
import type { OutputNodeData, OutputType } from '../../types/nodes';

interface OutputNodeProps {
  data: OutputNodeData;
  selected: boolean;
}

function getOutputIcon(type: OutputType) {
  switch (type) {
    case 'markdown':
    case 'document':
      return <FileText className="w-4 h-4 text-emerald-100" />;
    case 'image':
      return <Image className="w-4 h-4 text-emerald-100" />;
    case 'webpage':
      return <Globe className="w-4 h-4 text-emerald-100" />;
    case 'link':
      return <Link2 className="w-4 h-4 text-emerald-100" />;
    default:
      return <BarChart3 className="w-4 h-4 text-emerald-100" />;
  }
}

function OutputNode({ data, selected }: OutputNodeProps) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerIcon={getOutputIcon(data.outputType)}
      headerColor="bg-gradient-to-br from-emerald-500 to-green-700"
      showTargetHandle={true}
      showSourceHandle={false}
    >
      <div className="space-y-2">
        {data.layoutType && (
          <span className="inline-block px-2 py-0.5 text-xs bg-emerald-900/50 text-emerald-300 rounded">
            {data.layoutType}
          </span>
        )}
        {data.result && (
          <div className="text-xs text-gray-400 truncate max-w-[200px]">
            {data.result.substring(0, 50)}...
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export default memo(OutputNode);
