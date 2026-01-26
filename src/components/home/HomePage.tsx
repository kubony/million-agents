import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Settings } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useExecutionStore } from '../../stores/executionStore';
import ProjectCard from './ProjectCard';
import GalleryCard from './GalleryCard';
import CreateProjectDialog from './CreateProjectDialog';
import SettingsDialog from '../dialogs/SettingsDialog';
import RightSidebar from '../layout/RightSidebar';
import BottomConsolePanel from '../layout/BottomConsolePanel';
import { usePanelStore } from '../../stores/panelStore';

export default function HomePage() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    projects,
    galleryItems,
    isLoading,
    fetchProjects,
    createProject,
    setCurrentProject,
    navigateToPath,
    homeScrollPosition,
    setHomeScrollPosition,
    currentProject,
  } = useProjectStore();

  const { addLog } = useExecutionStore();
  const { isCollapsed, width } = usePanelStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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

  const filteredGallery = galleryItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              Build, edit and share AI skills
              <br />
              <span className="text-gray-400">using natural language</span>
            </h1>
          </div>

          {/* Your projects section */}
          <section className="mb-12 max-w-4xl mx-auto">
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
                <p className="text-gray-400 mb-4">Create your first project to get started</p>
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
                  />
                ))}
              </div>
            )}
          </section>

          {/* Gallery section */}
          <section className="max-w-4xl mx-auto pb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Gallery</h2>
              <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg">
                <Search className="w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 w-40"
                />
              </div>
            </div>

            {filteredGallery.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {searchQuery ? 'No templates found' : 'Gallery templates coming soon'}
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {filteredGallery.map((item) => (
                  <GalleryCard
                    key={item.id}
                    item={item}
                    onClick={() => {
                      // TODO: Clone from gallery
                      console.log('Clone gallery item:', item.id);
                    }}
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
