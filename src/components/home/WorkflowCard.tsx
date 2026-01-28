import { Play, GitBranch, Users, Zap } from 'lucide-react';
import type { WorkflowTemplate } from '../../types/project';

interface WorkflowCardProps {
  workflow: WorkflowTemplate;
  onClick: () => void;
  isLoading?: boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  content: <Users className="w-5 h-5" />,
  development: <GitBranch className="w-5 h-5" />,
  data: <Zap className="w-5 h-5" />,
  productivity: <Play className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  content: 'from-purple-500 to-pink-500',
  development: 'from-green-500 to-emerald-500',
  data: 'from-blue-500 to-cyan-500',
  productivity: 'from-orange-500 to-amber-500',
};

const categoryBadgeColors: Record<string, string> = {
  content: 'bg-purple-500/20 text-purple-400',
  development: 'bg-green-500/20 text-green-400',
  data: 'bg-blue-500/20 text-blue-400',
  productivity: 'bg-orange-500/20 text-orange-400',
};

export default function WorkflowCard({ workflow, onClick, isLoading }: WorkflowCardProps) {
  const gradient = categoryColors[workflow.category] || 'from-gray-500 to-gray-600';
  const badgeColor = categoryBadgeColors[workflow.category] || 'bg-gray-500/20 text-gray-400';
  const icon = categoryIcons[workflow.category] || <Zap className="w-5 h-5" />;

  return (
    <div
      onClick={onClick}
      className={`
        group relative w-72 bg-surface border border-border rounded-xl overflow-hidden
        hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 transition-all duration-300
        cursor-pointer
        ${isLoading ? 'pointer-events-none opacity-70' : ''}
      `}
    >
      {/* Gradient Header */}
      <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white">
          {icon}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-white font-semibold group-hover:text-accent transition-colors">
            {workflow.name}
          </h3>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>
            {workflow.category}
          </span>
        </div>

        <p className="text-gray-400 text-sm line-clamp-2 mb-3">
          {workflow.description}
        </p>

        {/* Tags */}
        {workflow.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {workflow.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-canvas text-gray-500 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs text-gray-500">by {workflow.author}</span>
          <button
            className="flex items-center gap-1 px-3 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-xs font-medium transition-colors"
          >
            <Play className="w-3 h-3" />
            Use Template
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-surface/80 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
