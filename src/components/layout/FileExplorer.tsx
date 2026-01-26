import { useEffect } from 'react';
import { FolderOpen, ArrowUpFromLine, Home, RefreshCw, ExternalLink } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import FileTreeItem from './FileTreeItem';

interface FileExplorerProps {
  className?: string;
}

export default function FileExplorer({ className = '' }: FileExplorerProps) {
  const {
    currentPath,
    parentPath,
    fileItems,
    isLoadingFiles,
    makeccHome,
    fetchFiles,
    fetchMakeccHome,
    navigateToPath,
  } = useProjectStore();

  useEffect(() => {
    // Initialize on mount
    const init = async () => {
      // Always fetch makeccHome first
      await fetchMakeccHome();
    };
    init();
  }, [fetchMakeccHome]);

  // Initial load: fetch files once when makeccHome is available and no files loaded
  useEffect(() => {
    if (makeccHome && fileItems.length === 0 && !isLoadingFiles) {
      const pathToFetch = currentPath || makeccHome;
      fetchFiles(pathToFetch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeccHome]); // Only depend on makeccHome for initial load

  // Get display path (replace home dir with ~)
  const displayPath = currentPath
    ? currentPath.replace(/^\/Users\/[^/]+/, '~')
    : '~/makecc';

  const handleItemClick = (item: typeof fileItems[0]) => {
    if (item.type === 'folder') {
      navigateToPath(item.path);
    }
  };

  const handleGoUp = () => {
    if (parentPath) {
      navigateToPath(parentPath);
    }
  };

  const handleGoHome = () => {
    if (makeccHome) {
      navigateToPath(makeccHome);
    }
  };

  const handleRefresh = () => {
    fetchFiles(currentPath);
  };

  const handleOpenInFinder = async () => {
    if (!currentPath) return;
    try {
      await fetch('/api/open-in-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath }),
      });
    } catch (error) {
      console.error('Failed to open in Finder:', error);
    }
  };

  return (
    <div className={`flex flex-col bg-surface ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-xs font-mono text-gray-400 truncate" title={currentPath}>
            {displayPath}
          </span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={handleGoHome}
            className="p-1.5 hover:bg-surface-hover rounded transition-colors"
            title="Go to makecc home"
          >
            <Home className="w-4 h-4 text-gray-500 hover:text-gray-300" />
          </button>
          <button
            onClick={handleGoUp}
            disabled={!parentPath}
            className="p-1.5 hover:bg-surface-hover rounded transition-colors disabled:opacity-30"
            title="상위 폴더"
          >
            <ArrowUpFromLine className="w-4 h-4 text-gray-500 hover:text-gray-300" />
          </button>
          <button
            onClick={handleOpenInFinder}
            className="p-1.5 hover:bg-surface-hover rounded transition-colors"
            title="파인더에서 보기"
          >
            <ExternalLink className="w-4 h-4 text-gray-500 hover:text-gray-300" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 hover:bg-surface-hover rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 hover:text-gray-300 ${isLoadingFiles ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoadingFiles ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : fileItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <FolderOpen className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs">Empty folder</span>
          </div>
        ) : (
          <div className="space-y-0.5 px-1">
            {fileItems.map((item) => (
              <FileTreeItem
                key={item.path}
                item={item}
                onClick={() => handleItemClick(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
