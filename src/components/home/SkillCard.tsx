import { Download, Check, Loader2, Trash2, Code, FileText } from 'lucide-react';
import type { GallerySkill } from '../../types/project';

interface SkillCardProps {
  skill: GallerySkill;
  isInstalling: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}

const categoryColors: Record<string, string> = {
  document: 'bg-blue-500/20 text-blue-400',
  git: 'bg-orange-500/20 text-orange-400',
  'ai-generation': 'bg-purple-500/20 text-purple-400',
  communication: 'bg-green-500/20 text-green-400',
  meta: 'bg-amber-500/20 text-amber-400',
  session: 'bg-cyan-500/20 text-cyan-400',
  utility: 'bg-gray-500/20 text-gray-400',
};

const categoryLabels: Record<string, string> = {
  document: 'Document',
  git: 'Git',
  'ai-generation': 'AI Gen',
  communication: 'Comm',
  meta: 'Meta',
  session: 'Session',
  utility: 'Utility',
};

export default function SkillCard({ skill, isInstalling, onInstall, onUninstall }: SkillCardProps) {
  const categoryColor = categoryColors[skill.category] || categoryColors.utility;
  const categoryLabel = categoryLabels[skill.category] || skill.category;

  return (
    <div className="group relative w-64 bg-surface border border-border rounded-xl p-4 hover:border-gray-600 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium text-sm truncate">{skill.name}</h4>
          <p className="text-gray-500 text-xs">by {skill.author}</p>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${categoryColor}`}>
          {categoryLabel}
        </span>
      </div>

      {/* Description */}
      <p className="text-gray-400 text-xs line-clamp-2 mb-3 min-h-[2.5rem]">
        {skill.description || 'No description'}
      </p>

      {/* Features */}
      <div className="flex items-center gap-2 mb-3">
        {skill.hasScripts && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Code className="w-3 h-3" />
            Scripts
          </span>
        )}
        {skill.hasRequirements && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <FileText className="w-3 h-3" />
            Deps
          </span>
        )}
      </div>

      {/* Action Button */}
      {skill.installed ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Check className="w-3 h-3" />
            Installed
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUninstall();
            }}
            disabled={isInstalling}
            className="ml-auto p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            title="Uninstall"
          >
            {isInstalling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInstall();
          }}
          disabled={isInstalling}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          {isInstalling ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Installing...
            </>
          ) : (
            <>
              <Download className="w-3 h-3" />
              Install
            </>
          )}
        </button>
      )}
    </div>
  );
}
