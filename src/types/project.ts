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

export type SkillSource = 'global' | 'local' | 'gallery';

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  source: SkillSource;
  path: string;
  tags: string[];
  hasScripts: boolean;
  hasRequirements: boolean;
}

export interface GallerySkill {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  repo: string;
  path: string;
  hasScripts: boolean;
  hasRequirements: boolean;
  installed?: boolean;
}
