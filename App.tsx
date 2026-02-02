import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import DAGVisualizer from './components/DAGVisualizer';
import BuilderBoard from './components/BuilderBoard';
import CodePreview from './components/CodePreview';
import { ViewMode, AppConfig, Project, Task } from './types';
import { generateProjectPlan, executeTask, extractFilesFromOutput } from './services/aiService';
import { Sparkles, Terminal, ArrowRight, Activity, Layers, GitMerge } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [config, setConfig] = useState<AppConfig>({
    provider: 'google', 
    openRouterKey: '',
    model: 'gemini-3-flash-preview'
  });
  
  const [projectIdea, setProjectIdea] = useState('');
  const [project, setProject] = useState<Project | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Load config from local storage
  useEffect(() => {
    const savedConfig = localStorage.getItem('nexbuilder_config');
    if (savedConfig) setConfig(JSON.parse(savedConfig));
  }, []);

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    localStorage.setItem('nexbuilder_config', JSON.stringify(newConfig));
    setCurrentView('home');
  };

  const handleCreateProject = async () => {
    if (!projectIdea) return;
    setIsGenerating(true);
    try {
      const plan = await generateProjectPlan(projectIdea, config);
      const newProject: Project = {
        id: crypto.randomUUID(),
        name: plan.name || 'New Project',
        description: projectIdea,
        tasks: plan.tasks.map(t => ({ ...t, status: 'pending' })),
        files: [],
        createdAt: Date.now()
      };
      setProject(newProject);
      setCurrentView('planner');
    } catch (e) {
      alert(`Error generating plan: ${(e as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteTask = async (task: Task) => {
    if (!project) return;
    setIsExecuting(true);
    
    // Update status to in_progress
    const updatedTasks = project.tasks.map(t => 
      t.id === task.id ? { ...t, status: 'in_progress' as const } : t
    );
    setProject({ ...project, tasks: updatedTasks });

    try {
      // Gather context
      const context = task.dependencies
        .map(depId => {
          const t = project.tasks.find(pt => pt.id === depId);
          return t ? `Task "${t.title}":\n${t.output}` : '';
        })
        .join('\n\n');
      
      // Also provide list of existing files to the agent so it knows what to edit
      const fileContext = project.files.length > 0 
        ? `\nExisting Files:\n${project.files.map(f => `- ${f.path}`).join('\n')}` 
        : '';

      const output = await executeTask(task, context + fileContext, config);
      
      // Extract files from output
      const newFiles = extractFilesFromOutput(output);

      setProject(prev => {
        if (!prev) return null;
        
        // Merge new files with existing ones (overwrite if path exists)
        const updatedFiles = [...prev.files];
        newFiles.forEach(nf => {
          const index = updatedFiles.findIndex(f => f.path === nf.path);
          if (index >= 0) {
            updatedFiles[index] = nf;
          } else {
            updatedFiles.push(nf);
          }
        });

        return {
          ...prev,
          files: updatedFiles,
          tasks: prev.tasks.map(t => 
            t.id === task.id ? { ...t, status: 'completed' as const, output } : t
          )
        };
      });
    } catch (e) {
      setProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          tasks: prev.tasks.map(t => 
            t.id === task.id ? { ...t, status: 'failed' as const } : t
          )
        };
      });
      alert('Task execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const renderContent = () => {
    if (currentView === 'settings') {
      return <SettingsModal config={config} onSave={handleSaveConfig} />;
    }

    if (!project && currentView !== 'settings') {
      return (
        <div className="max-w-3xl mx-auto mt-20 text-center animate-in fade-in duration-700">
          <div className="inline-block p-4 rounded-full bg-blue-500/10 mb-6 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <Sparkles size={40} className="text-blue-400" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 tracking-tight">
            What shall we build today?
          </h1>
          <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
            Describe your application idea. The architect agent will decompose it into a task graph and execute it step-by-step.
          </p>
          
          <div className="relative group max-w-xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex bg-slate-900 rounded-2xl p-2 border border-slate-700 shadow-2xl">
              <input 
                type="text" 
                value={projectIdea}
                onChange={(e) => setProjectIdea(e.target.value)}
                placeholder="e.g. A React Kanban board with drag and drop..."
                className="flex-1 bg-transparent border-none outline-none text-white px-4 text-lg placeholder-slate-600"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              />
              <button 
                onClick={handleCreateProject}
                disabled={isGenerating || !projectIdea}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-3 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGenerating ? (
                  <>Initializing...</>
                ) : (
                  <>Create <ArrowRight size={18} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (project) {
      switch (currentView) {
        case 'home':
          return (
            <div className="max-w-4xl mx-auto mt-10">
              <div className="glass-panel p-8 rounded-3xl border-l-4 border-l-blue-500">
                <h2 className="text-3xl font-bold mb-2">{project.name}</h2>
                <p className="text-slate-400 mb-6">{project.description}</p>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 p-4 rounded-xl">
                    <div className="text-slate-500 text-xs uppercase font-bold">Tasks</div>
                    <div className="text-2xl font-mono">{project.tasks.length}</div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-xl">
                    <div className="text-slate-500 text-xs uppercase font-bold">Files</div>
                    <div className="text-2xl font-mono text-purple-400">{project.files.length}</div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-xl">
                    <div className="text-slate-500 text-xs uppercase font-bold">Completed</div>
                    <div className="text-2xl font-mono text-emerald-400">
                      {project.tasks.filter(t => t.status === 'completed').length}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-xl">
                    <div className="text-slate-500 text-xs uppercase font-bold">Status</div>
                    <div className="text-2xl font-mono text-blue-400">Active</div>
                  </div>
                </div>
              </div>
            </div>
          );
        case 'planner':
          return (
            <div className="h-full flex flex-col p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <GitMerge className="text-purple-400" /> Execution Graph
                </h2>
                <span className="text-slate-500 text-sm">Generated Architecture (DAG)</span>
              </div>
              <div className="flex-1 min-h-0">
                <DAGVisualizer tasks={project.tasks} />
              </div>
            </div>
          );
        case 'builder':
          return (
            <div className="h-full flex flex-col p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <Activity className="text-emerald-400" /> Construction Zone
                </h2>
                {isExecuting && (
                  <div className="flex items-center gap-2 text-blue-400 text-sm bg-blue-500/10 px-3 py-1 rounded-full animate-pulse">
                    <Terminal size={14} /> Agent is working...
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-0">
                <BuilderBoard 
                  tasks={project.tasks} 
                  onExecute={handleExecuteTask} 
                  isExecuting={isExecuting}
                />
              </div>
            </div>
          );
        case 'preview':
          return <CodePreview project={project} />;
        default: 
          return null;
      }
    }
    return null;
  };

  return (
    <div className="flex min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50rem] h-[50rem] bg-blue-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50rem] h-[50rem] bg-purple-600/10 rounded-full blur-[100px]"></div>
      </div>

      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="flex-1 ml-64 relative z-10 h-screen overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;