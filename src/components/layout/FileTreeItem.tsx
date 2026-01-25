import { Folder, File, ChevronRight } from 'lucide-react';
import type { FileItem } from '../../types/file';

interface FileTreeItemProps {
  item: FileItem;
  onClick: () => void;
  depth?: number;
}

export default function FileTreeItem({ item, onClick, depth = 0 }: FileTreeItemProps) {
  const isFolder = item.type === 'folder';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-surface-hover rounded-md transition-colors text-left group"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      {isFolder ? (
        <>
          <ChevronRight className="w-3 h-3 text-gray-500 group-hover:text-gray-400 flex-shrink-0" />
          <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
        </>
      ) : (
        <>
          <span className="w-3" /> {/* Spacer for alignment */}
          <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </>
      )}
      <span className="text-sm text-gray-300 truncate group-hover:text-white">
        {item.name}
      </span>
    </button>
  );
}
