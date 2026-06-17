import { Users, Activity, ChevronRight, Trash2, Hexagon } from 'lucide-react';
import { format } from 'date-fns';

interface ProjectGridProps {
  projects: any[];
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

export const ProjectGrid = ({ projects, onSelectProject, onDeleteProject }: ProjectGridProps) => {
  return (
    <div className="flex-1 overflow-y-auto p-12 bg-discord-darkest relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-discord-cyan/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="mb-12">
          <div className="flex items-center space-x-4 mb-2">
            <div className="p-3 bg-discord-cyan/10 rounded-2xl border border-discord-cyan/20">
              <Hexagon className="w-8 h-8 text-discord-cyan fill-discord-cyan/10" />
            </div>
            <div>
              <h2 className="text-4xl font-black text-white tracking-tight">CODEHIVE</h2>
              <p className="text-discord-muted text-sm font-medium uppercase tracking-[0.2em]">Autonomous Agent Orchestration</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map(project => (
            <div
              key={project.id}
              className="group relative bg-discord-darker border border-white/5 hover:border-discord-cyan/40 hover:bg-discord-dark transition-all duration-300 rounded-2xl p-8 flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Delete Button */}
              {project.id !== 'local' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete project '${project.name}'? All agents and data will be removed.`)) {
                      onDeleteProject(project.id);
                    }
                  }}
                  className="absolute top-6 right-6 z-20 p-2 text-discord-muted hover:text-discord-red hover:bg-discord-red/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  title="Delete Project"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={() => onSelectProject(project.id)}
                className="text-left w-full h-full flex flex-col items-start"
              >
                <div className="flex justify-between items-center w-full mb-6">
                  <div className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                    project.status === 'active' ? 'bg-discord-green/20 text-discord-green border border-discord-green/20' : 'bg-gray-800 text-gray-500'
                  }`}>
                    {project.status}
                  </div>
                  <div className="text-[10px] text-discord-muted font-semibold">
                    {format(new Date(project.createdAt), 'MMM yyyy')}
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-white group-hover:text-discord-cyan transition-colors mb-3">
                  {project.name}
                </h3>

                <p className="text-sm text-discord-muted leading-relaxed mb-8 h-10 line-clamp-2">
                  {project.description || 'System mission and tactical overview for this autonomous deployment.'}
                </p>

                <div className="mt-auto w-full">
                  <div className="flex items-center space-x-6 mb-6">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-discord-cyan" />
                      <span className="text-sm font-bold text-discord-light">{project.agentCount}</span>
                      <span className="text-[10px] font-bold text-discord-muted uppercase">Agents</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-discord-yellow" />
                      <span className="text-sm font-bold text-discord-light">{project.activeTasksCount}</span>
                      <span className="text-[10px] font-bold text-discord-muted uppercase">Tasks</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-4 border-t border-white/5 group-hover:border-discord-cyan/20 transition-all">
                    <span className="text-xs font-bold text-discord-muted group-hover:text-discord-cyan uppercase tracking-widest">Connect to Hive</span>
                    <ChevronRight className="w-5 h-5 text-discord-muted group-hover:text-discord-cyan group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </button>

              {/* Decorative Corner */}
              <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-discord-cyan/5 rounded-full blur-2xl group-hover:bg-discord-cyan/10 transition-all" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
