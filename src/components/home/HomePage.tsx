import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Settings, RefreshCw } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useExecutionStore } from '../../stores/executionStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import ProjectCard from './ProjectCard';
import WorkflowCard from './WorkflowCard';
import CreateProjectDialog from './CreateProjectDialog';
import SettingsDialog from '../dialogs/SettingsDialog';
import RightSidebar from '../layout/RightSidebar';
import BottomConsolePanel from '../layout/BottomConsolePanel';
import { usePanelStore } from '../../stores/panelStore';
import type { WorkflowTemplate } from '../../types/project';

export default function HomePage() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    projects,
    workflowTemplates,
    isLoading,
    isLoadingWorkflows,
    fetchProjects,
    fetchWorkflowTemplates,
    getWorkflowData,
    createProject,
    deleteProject,
    copyProject,
    setCurrentProject,
    navigateToPath,
    homeScrollPosition,
    setHomeScrollPosition,
    currentProject,
    makeccHome,
    gallerySkills,
    fetchGallerySkills,
    installSkill,
  } = useProjectStore();

  const { setNodes, setEdges, setWorkflowName } = useWorkflowStore();
  const { addLog } = useExecutionStore();
  const { isCollapsed, width } = usePanelStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loadingWorkflowId, setLoadingWorkflowId] = useState<string | null>(null);

  // Track previous currentProject to detect changes from Explorer navigation
  const prevProjectRef = useRef<typeof currentProject>(currentProject);
  const initialSyncDone = useRef(false);

  useEffect(() => {
    fetchProjects();
    fetchWorkflowTemplates();
    fetchGallerySkills();
  }, [fetchProjects, fetchWorkflowTemplates, fetchGallerySkills]);

  // Sync Explorer to home when HomePage mounts
  useEffect(() => {
    if (makeccHome && !initialSyncDone.current) {
      navigateToPath(makeccHome);
      setCurrentProject(null);
      initialSyncDone.current = true;
    }
  }, [makeccHome, navigateToPath, setCurrentProject]);

  // Auto-navigate when currentProject changes via Explorer
  useEffect(() => {
    // Skip if initial sync not done yet
    if (!initialSyncDone.current) return;

    if (currentProject && currentProject !== prevProjectRef.current) {
      navigate(`/project/${encodeURIComponent(currentProject.name)}`);
    }
    prevProjectRef.current = currentProject;
  }, [currentProject, navigate]);

  // Restore scroll position on mount
  useEffect(() => {
    if (scrollContainerRef.current && homeScrollPosition > 0) {
      scrollContainerRef.current.scrollTop = homeScrollPosition;
    }
  }, [homeScrollPosition]);

  // Save scroll position on scroll
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setHomeScrollPosition(scrollContainerRef.current.scrollTop);
    }
  }, [setHomeScrollPosition]);

  // Log when projects are loaded
  useEffect(() => {
    if (projects.length > 0) {
      addLog('info', `Loaded ${projects.length} project(s)`);
    }
  }, [projects.length, addLog]);

  const handleProjectClick = (project: typeof projects[0]) => {
    setCurrentProject(project);
    // Navigate file explorer to project path
    if (project.path) {
      navigateToPath(project.path);
    }
    addLog('info', `Opening project: ${project.name}`);
    navigate(`/project/${encodeURIComponent(project.name)}`);
  };

  const handleCreateProject = async (name: string, description: string) => {
    const project = await createProject(name, description);
    if (project) {
      handleProjectClick(project);
    }
  };

  const handleCopyProject = async (project: typeof projects[0]) => {
    addLog('info', `Copying project: ${project.name}`);
    const copied = await copyProject(project.id);
    if (copied) {
      addLog('info', `Project copied: ${copied.name}`);
    }
  };

  const handleDeleteProject = async (project: typeof projects[0]) => {
    if (window.confirm(`"${project.name}" 프로젝트를 삭제하시겠습니까?`)) {
      addLog('info', `Deleting project: ${project.name}`);
      const success = await deleteProject(project.id);
      if (success) {
        addLog('info', `Project deleted: ${project.name}`);
      }
    }
  };

  const handleWorkflowClick = async (workflow: WorkflowTemplate) => {
    setLoadingWorkflowId(workflow.id);
    addLog('info', `Loading workflow template: ${workflow.name}`);

    try {
      // 1. Get workflow data from GitHub
      const workflowData = await getWorkflowData(workflow.id);
      if (!workflowData) {
        addLog('error', `Failed to load workflow: ${workflow.id}`);
        return;
      }

      // 2. Extract required skills from workflow nodes and install them
      const skillNodes = workflowData.nodes.filter(
        (node: any) => node.type === 'skill' && node.data?.skillId
      );
      const requiredSkillIds = [...new Set(skillNodes.map((node: any) => node.data.skillId))] as string[];

      if (requiredSkillIds.length > 0) {
        addLog('info', `Installing required skills: ${requiredSkillIds.join(', ')}`);

        for (const skillId of requiredSkillIds) {
          const gallerySkill = gallerySkills.find((s) => s.id === skillId);
          if (gallerySkill && !gallerySkill.installed) {
            addLog('info', `Installing skill: ${skillId}`);
            const result = await installSkill(skillId);
            if (result.success) {
              addLog('info', `Skill installed: ${skillId}`);
            } else {
              addLog('warning', `Failed to install skill ${skillId}: ${result.message}`);
            }
          }
        }
      }

      // 3. Create new project
      const project = await createProject(workflow.name, workflow.description);
      if (!project) {
        addLog('error', 'Failed to create project');
        return;
      }

      // 4. Load workflow into store
      setWorkflowName(workflowData.name);
      setNodes(workflowData.nodes as any[]);
      setEdges(workflowData.edges as any[]);

      // 5. Navigate to project
      setCurrentProject(project);
      if (project.path) {
        navigateToPath(project.path);
      }
      addLog('info', `Created project from template: ${project.name}`);
      navigate(`/project/${encodeURIComponent(project.name)}`);
    } catch (error) {
      console.error('Failed to create project from workflow:', error);
      addLog('error', 'Failed to create project from workflow');
    } finally {
      setLoadingWorkflowId(null);
    }
  };

  const filteredWorkflows = workflowTemplates.filter((workflow) => {
    const matchesSearch =
      workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workflow.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || workflow.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(workflowTemplates.map((w) => w.category))];

  return (
    <div className="h-screen flex flex-col bg-canvas overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-lg font-semibold text-white">makecc</span>
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-300 rounded-full">
            beta
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </header>

      {/* Main content - 2 column layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left column - Projects and Gallery */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-8"
        >
          {/* Hero text */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Build AI workflows visually
              <br />
              <span className="text-gray-400">with drag & drop</span>
            </h1>
          </div>

          {/* Your projects section */}
          <section className="mb-12 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Your projects</h2>
              <button
                onClick={() => setIsCreateDialogOpen(true)}
                className="flex items-center gap-2 px-4 py-2 border border-border hover:bg-surface-hover rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-white">Create New</span>
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-gray-800 flex items-center justify-center">
                  <Plus className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
                <p className="text-gray-400 mb-4">Create a new project or use a template below</p>
                <button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="px-6 py-2 bg-accent hover:bg-accent-hover rounded-lg font-medium text-white transition-colors"
                >
                  Create Project
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-6">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => handleProjectClick(project)}
                    isSelected={currentProject?.id === project.id}
                    onCopy={handleCopyProject}
                    onDelete={handleDeleteProject}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Workflow Gallery section */}
          <section className="max-w-5xl mx-auto pb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-white">Workflow Templates</h2>
                <span className="px-2 py-0.5 text-xs font-medium bg-accent/20 text-accent rounded-full">
                  {workflowTemplates.length} templates
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fetchWorkflowTemplates()}
                  disabled={isLoadingWorkflows}
                  className="p-2 hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoadingWorkflows ? 'animate-spin' : ''}`} />
                </button>
                <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg">
                  <Search className="w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 w-40"
                  />
                </div>
              </div>
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? 'bg-accent text-white'
                      : 'bg-surface border border-border text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                >
                  {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>

            {isLoadingWorkflows ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredWorkflows.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {searchQuery || selectedCategory !== 'all'
                  ? 'No templates found matching your criteria'
                  : 'No templates available'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-6">
                {filteredWorkflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    onClick={() => handleWorkflowClick(workflow)}
                    isLoading={loadingWorkflowId === workflow.id}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar - same structure as project page */}
        {!isCollapsed && (
          <div
            className="border-l border-border bg-surface flex-shrink-0"
            style={{ width: `${width}px` }}
          >
            <RightSidebar showProperties={false} />
          </div>
        )}
      </main>

      {/* Bottom - Console Panel */}
      <BottomConsolePanel />

      {/* Dialogs */}
      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreateProject}
      />

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
