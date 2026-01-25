import { create } from 'zustand';
import type { Project, GalleryItem } from '../types/project';

interface ProjectStore {
  // State
  projects: Project[];
  galleryItems: GalleryItem[];
  isLoading: boolean;
  error: string | null;
  currentProject: Project | null;

  // Actions
  setProjects: (projects: Project[]) => void;
  setGalleryItems: (items: GalleryItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentProject: (project: Project | null) => void;
  fetchProjects: () => Promise<void>;
  createProject: (name: string, description: string) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<boolean>;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  // Initial state
  projects: [],
  galleryItems: [],
  isLoading: false,
  error: null,
  currentProject: null,

  // Actions
  setProjects: (projects) => set({ projects }),
  setGalleryItems: (items) => set({ galleryItems: items }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setCurrentProject: (project) => set({ currentProject: project }),

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      set({ projects: data.projects, galleryItems: data.gallery || [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  createProject: async (name: string, description: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) {
        throw new Error('Failed to create project');
      }
      const project = await response.json();
      set((state) => ({ projects: [project, ...state.projects] }));
      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteProject: async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete project');
      }
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
      }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return false;
    }
  },
}));
