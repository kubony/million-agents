import { useState, useEffect, useCallback } from 'react';
import { X, Search, Download, Check, Loader2, GripVertical } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useExecutionStore } from '../../stores/executionStore';
import type { GallerySkill } from '../../types/project';
import type { SkillNodeData, WorkflowNode } from '../../types/nodes';
import { nanoid } from 'nanoid';

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export default function GalleryModal({ isOpen, onClose }: GalleryModalProps) {
  const {
    gallerySkills,
    isLoadingGallery,
    installingSkillId,
    fetchGallerySkills,
    installSkill,
  } = useProjectStore();
  const { addNode, nodes } = useWorkflowStore();
  const { addLog } = useExecutionStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [draggedSkill, setDraggedSkill] = useState<GallerySkill | null>(null);

  useEffect(() => {
    if (isOpen && gallerySkills.length === 0) {
      fetchGallerySkills();
    }
  }, [isOpen, gallerySkills.length, fetchGallerySkills]);

  const filteredSkills = gallerySkills.filter((skill) => {
    const matchesSearch =
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(gallerySkills.map((s) => s.category))];

  const createSkillNode = useCallback((skill: GallerySkill, position?: { x: number; y: number }) => {
    // Calculate position - center of canvas or specified position
    const defaultPosition = {
      x: 400 + (nodes.length % 3) * 50,
      y: 200 + Math.floor(nodes.length / 3) * 100,
    };

    const nodeData: SkillNodeData = {
      label: skill.name,
      description: skill.description,
      status: 'idle',
      skillType: 'official',
      skillId: skill.id,
      skillCategory: skill.category,
      skillPath: `~/.claude/skills/${skill.id}`,
    };

    const newNode: WorkflowNode = {
      id: `skill-${nanoid(8)}`,
      type: 'skill',
      position: position || defaultPosition,
      data: nodeData,
    } as WorkflowNode;

    addNode(newNode);
    addLog('info', `Added skill node: ${skill.name}`);
  }, [addNode, addLog, nodes.length]);

  const handleSkillClick = async (skill: GallerySkill) => {
    // If not installed, install first
    if (!skill.installed) {
      const result = await installSkill(skill.id);
      if (!result.success) {
        addLog('error', `Failed to install skill: ${result.message}`);
        return;
      }
      addLog('info', `Skill "${skill.id}" installed`);
    }

    // Add to canvas
    createSkillNode(skill);
    onClose();
  };

  const handleDragStart = (e: React.DragEvent, skill: GallerySkill) => {
    setDraggedSkill(skill);
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'gallery-skill',
      skill,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggedSkill(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[80vh] bg-surface border border-border rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-white">Skill Gallery</h2>
            <p className="text-sm text-gray-400 mt-1">
              Click to add or drag to canvas
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="px-6 py-4 border-b border-border space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-canvas border border-border rounded-lg">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-gray-500"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-accent text-white'
                    : 'bg-canvas border border-border text-gray-400 hover:text-white hover:border-gray-600'
                }`}
              >
                {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Skills Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoadingGallery ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              No skills found
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredSkills.map((skill) => (
                <div
                  key={skill.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, skill)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleSkillClick(skill)}
                  className={`
                    group relative p-4 bg-canvas border border-border rounded-xl cursor-pointer
                    hover:border-accent/50 hover:bg-accent/5 transition-all
                    ${draggedSkill?.id === skill.id ? 'opacity-50' : ''}
                    ${installingSkillId === skill.id ? 'pointer-events-none opacity-70' : ''}
                  `}
                >
                  {/* Drag Handle */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-4 h-4 text-gray-500" />
                  </div>

                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{skill.name}</h4>
                    </div>
                    <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${categoryColors[skill.category] || categoryColors.utility}`}>
                      {skill.category.replace('-', ' ')}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-400 line-clamp-2 mb-3">
                    {skill.description || 'No description'}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">by {skill.author}</span>
                    {installingSkillId === skill.id ? (
                      <Loader2 className="w-4 h-4 text-accent animate-spin" />
                    ) : skill.installed ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <Check className="w-3 h-3" />
                        Installed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-500 group-hover:text-accent">
                        <Download className="w-3 h-3" />
                        Click to install
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border text-xs text-gray-500 text-center">
          {gallerySkills.length} skills available from{' '}
          <a
            href="https://github.com/kubony/makecc-gallery"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            makecc-gallery
          </a>
        </div>
      </div>
    </div>
  );
}
