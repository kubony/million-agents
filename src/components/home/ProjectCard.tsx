import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Cpu, Zap, Copy, Trash2 } from 'lucide-react';
import type { Project } from '../../types/project';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  isSelected?: boolean;
  onCopy?: (project: Project) => void;
  onDelete?: (project: Project) => void;
}

// 프로젝트 이름에 따른 그라데이션 색상
const gradients = [
  'from-purple-600 to-blue-600',
  'from-pink-600 to-rose-600',
  'from-emerald-600 to-teal-600',
  'from-amber-600 to-orange-600',
  'from-indigo-600 to-violet-600',
  'from-cyan-600 to-blue-600',
];

function getGradient(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

export default function ProjectCard({ project, onClick, isSelected = false, onCopy, onDelete }: ProjectCardProps) {
  const gradient = getGradient(project.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <div
      onClick={onClick}
      className={`group relative w-72 h-56 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/20 ${
        isSelected ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-canvas scale-[1.02]' : ''
      }`}
    >
      {/* Background container with overflow-hidden for rounded corners */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        {/* Background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

        {/* Decorative shape */}
        <div className="absolute top-4 right-4 w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-sm transform rotate-12" />
      </div>

      {/* Hover tooltip */}
      <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-xs text-white/90 opacity-0 group-hover:opacity-100 transition-opacity">
        클릭하여 열기
      </div>

      {/* Menu button & dropdown */}
      <div ref={menuRef} className="absolute top-3 right-3 z-50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-all pointer-events-auto"
        >
          <MoreVertical className="w-5 h-5 text-white" />
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="absolute top-8 right-0 w-32 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onCopy?.(project);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-zinc-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              복사
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete?.(project);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/60 to-transparent">
        <h3 className="text-xl font-bold text-white mb-1">{project.name}</h3>
        <p className="text-sm text-white/80 line-clamp-2 mb-3">{project.description}</p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-white/70 text-xs">
          <div className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            <span>{project.skillCount} skills</span>
          </div>
          <div className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" />
            <span>{project.agentCount} agents</span>
          </div>
        </div>
      </div>
    </div>
  );
}
