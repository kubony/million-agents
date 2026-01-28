import { create } from 'zustand';
import type { Project, GalleryItem, GallerySkill, WorkflowTemplate, WorkflowData } from '../types/project';
import type { FileItem } from '../types/file';

interface ProjectStore {
  // State
  projects: Project[];
  galleryItems: GalleryItem[];
  gallerySkills: GallerySkill[];
  workflowTemplates: WorkflowTemplate[];
  isLoading: boolean;
  isLoadingGallery: boolean;
  isLoadingWorkflows: boolean;
  installingSkillId: string | null;
  error: string | null;
  currentProject: Project | null;

  // File explorer state
  currentPath: string;
  parentPath: string | null;
  fileItems: FileItem[];
  isLoadingFiles: boolean;
  makeccHome: string;

  // UI state persistence
  homeScrollPosition: number;

  // Actions
  setProjects: (projects: Project[]) => void;
  setGalleryItems: (items: GalleryItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentProject: (project: Project | null) => void;
  fetchProjects: () => Promise<void>;
  createProject: (name: string, description: string) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<boolean>;
  copyProject: (id: string) => Promise<Project | null>;

  // Gallery actions
  fetchGallerySkills: () => Promise<void>;
  installSkill: (skillId: string) => Promise<{ success: boolean; message: string }>;
  uninstallSkill: (skillId: string) => Promise<{ success: boolean; message: string }>;

  // Workflow gallery actions
  fetchWorkflowTemplates: () => Promise<void>;
  getWorkflowData: (workflowId: string) => Promise<WorkflowData | null>;
  createProjectFromWorkflow: (workflowId: string) => Promise<Project | null>;

  // File explorer actions
  fetchFiles: (path?: string) => Promise<void>;
  navigateToPath: (path: string) => Promise<void>;
  fetchMakeccHome: () => Promise<void>;

  // UI state actions
  setHomeScrollPosition: (position: number) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initial state
  projects: [],
  galleryItems: [],
  gallerySkills: [],
  workflowTemplates: [],
  isLoading: false,
  isLoadingGallery: false,
  isLoadingWorkflows: false,
  installingSkillId: null,
  error: null,
  currentProject: null,

  // File explorer initial state
  currentPath: '',
  parentPath: null,
  fileItems: [],
  isLoadingFiles: false,
  makeccHome: '',

  // UI state persistence
  homeScrollPosition: 0,

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

  copyProject: async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}/copy`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to copy project');
      }
      const project = await response.json();
      set((state) => ({ projects: [project, ...state.projects] }));
      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return null;
    }
  },

  // File explorer actions
  fetchMakeccHome: async () => {
    try {
      const response = await fetch('/api/makecc-home');
      if (!response.ok) {
        throw new Error('Failed to fetch makecc home');
      }
      const data = await response.json();
      const { currentPath } = get();
      // Only set currentPath if it's not already set (preserve existing path)
      set({
        makeccHome: data.path,
        currentPath: currentPath || data.path,
      });
    } catch (error) {
      console.error('Failed to fetch makecc home:', error);
    }
  },

  fetchFiles: async (path?: string) => {
    const { makeccHome, currentPath } = get();
    const targetPath = path || currentPath || makeccHome;

    if (!targetPath) {
      return;
    }

    set({ isLoadingFiles: true });
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(targetPath)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();

      // 현재 경로가 어떤 프로젝트에 속하는지 확인하고 currentProject 업데이트
      // 단, projects가 로드되지 않았으면 currentProject를 변경하지 않음 (race condition 방지)
      const { projects } = get();

      if (projects.length > 0) {
        const matchedProject = projects.find((project) => {
          if (!project.path) return false;
          return data.currentPath === project.path ||
                 data.currentPath.startsWith(project.path + '/');
        });

        set({
          currentPath: data.currentPath,
          parentPath: data.parentPath,
          fileItems: data.items,
          currentProject: matchedProject || null,
        });
      } else {
        // projects가 비어있으면 currentProject는 유지
        set({
          currentPath: data.currentPath,
          parentPath: data.parentPath,
          fileItems: data.items,
        });
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
      set({ fileItems: [] });
    } finally {
      set({ isLoadingFiles: false });
    }
  },

  navigateToPath: async (path: string) => {
    // 직접 API 호출하여 클로저/참조 문제 방지
    set({ isLoadingFiles: true });
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();

      // 현재 경로가 어떤 프로젝트에 속하는지 확인하고 currentProject 업데이트
      // 단, projects가 로드되지 않았으면 currentProject를 변경하지 않음 (race condition 방지)
      const { projects } = get();

      if (projects.length > 0) {
        const matchedProject = projects.find((project) => {
          if (!project.path) return false;
          // 현재 경로가 프로젝트 경로와 같거나 하위 경로인지 확인
          return data.currentPath === project.path ||
                 data.currentPath.startsWith(project.path + '/');
        });

        set({
          currentPath: data.currentPath,
          parentPath: data.parentPath,
          fileItems: data.items,
          currentProject: matchedProject || null,
        });
      } else {
        // projects가 비어있으면 currentProject는 유지
        set({
          currentPath: data.currentPath,
          parentPath: data.parentPath,
          fileItems: data.items,
        });
      }
    } catch (error) {
      console.error('Failed to navigate to path:', error);
      set({ fileItems: [] });
    } finally {
      set({ isLoadingFiles: false });
    }
  },

  // UI state actions
  setHomeScrollPosition: (position: number) => set({ homeScrollPosition: position }),

  // Gallery actions
  fetchGallerySkills: async () => {
    set({ isLoadingGallery: true });
    try {
      const response = await fetch('/api/gallery/skills');
      if (!response.ok) {
        throw new Error('Failed to fetch gallery skills');
      }
      const data = await response.json();
      set({ gallerySkills: data.skills || [] });
    } catch (error) {
      console.error('Failed to fetch gallery skills:', error);
      set({ gallerySkills: [] });
    } finally {
      set({ isLoadingGallery: false });
    }
  },

  installSkill: async (skillId: string) => {
    set({ installingSkillId: skillId });
    try {
      const response = await fetch(`/api/gallery/skills/${skillId}/install`, {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        // Update the installed status in gallerySkills
        set((state) => ({
          gallerySkills: state.gallerySkills.map((skill) =>
            skill.id === skillId ? { ...skill, installed: true } : skill
          ),
        }));
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message };
    } finally {
      set({ installingSkillId: null });
    }
  },

  uninstallSkill: async (skillId: string) => {
    set({ installingSkillId: skillId });
    try {
      const response = await fetch(`/api/gallery/skills/${skillId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        // Update the installed status in gallerySkills
        set((state) => ({
          gallerySkills: state.gallerySkills.map((skill) =>
            skill.id === skillId ? { ...skill, installed: false } : skill
          ),
        }));
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message };
    } finally {
      set({ installingSkillId: null });
    }
  },

  // Workflow gallery actions
  fetchWorkflowTemplates: async () => {
    set({ isLoadingWorkflows: true });
    try {
      const response = await fetch('/api/gallery/workflows');
      if (!response.ok) {
        throw new Error('Failed to fetch workflow templates');
      }
      const data = await response.json();
      set({ workflowTemplates: data.workflows || [] });
    } catch (error) {
      console.error('Failed to fetch workflow templates:', error);
      set({ workflowTemplates: [] });
    } finally {
      set({ isLoadingWorkflows: false });
    }
  },

  getWorkflowData: async (workflowId: string) => {
    try {
      const response = await fetch(`/api/gallery/workflows/${workflowId}`);
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data as WorkflowData;
    } catch (error) {
      console.error('Failed to fetch workflow data:', error);
      return null;
    }
  },

  createProjectFromWorkflow: async (workflowId: string) => {
    const { workflowTemplates, createProject } = get();
    const template = workflowTemplates.find((w) => w.id === workflowId);

    if (!template) {
      console.error('Workflow template not found:', workflowId);
      return null;
    }

    // Create project with workflow name
    const project = await createProject(template.name, template.description);
    return project;
  },
}));
