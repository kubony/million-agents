// Project types for home page

export interface Project {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  skillCount: number;
  agentCount: number;
  path: string;
  lastModified: string;
  createdAt: string;
}

export interface GalleryItem {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  author: string;
  downloads: number;
  tags: string[];
}
