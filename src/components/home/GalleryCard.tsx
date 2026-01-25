import { Download } from 'lucide-react';
import type { GalleryItem } from '../../types/project';

interface GalleryCardProps {
  item: GalleryItem;
  onClick: () => void;
}

export default function GalleryCard({ item, onClick }: GalleryCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative w-56 h-56 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20"
    >
      {/* Thumbnail */}
      {item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800" />
      )}

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
        <h4 className="text-white font-semibold text-sm mb-1">{item.name}</h4>
        <p className="text-white/70 text-xs line-clamp-2 mb-2">{item.description}</p>
        <div className="flex items-center gap-2 text-white/60 text-xs">
          <Download className="w-3 h-3" />
          <span>{item.downloads}</span>
        </div>
      </div>
    </div>
  );
}
