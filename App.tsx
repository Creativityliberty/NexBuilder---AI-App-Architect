import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import DAGVisualizer from './components/DAGVisualizer';
import BuilderBoard from './components/BuilderBoard';
import CodePreview from './components/CodePreview';
import HistoryView from './components/HistoryView';
import { ViewMode, AppConfig, Project, Task, ActivityLogEntry } from './types';
import { generateProjectPlan, executeTask, extractFilesFromOutput, decomposeTask } from './services/aiService';
import { Sparkles, Terminal, ArrowRight, Activity, Layers, GitMerge, Trash2, History, Save, Scissors, AlertTriangle } from 'lucide-react';

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
  const [isSplitting, setIsSplitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<number>(Date.now());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialization: Load config and state from local storage
  useEffect(() => {
    // 1. Config
    const savedConfig = localStorage.getItem('nexbuilder_config');
    if (savedConfig) setConfig(JSON.parse(savedConfig));

    // 2. Project Idea Input
    const savedIdea = localStorage.getItem('nexbuilder_idea');
    if (savedIdea) setProjectIdea(savedIdea);

    // 3. Full Project State
    const savedProject = localStorage.getItem('nexbuilder_project');
    if (savedProject) {
        try {
            const loadedProject: Project = JSON.parse(savedProject);
            
            // CRASH RECOVERY
            loadedProject.tasks = loadedProject.tasks.map(t => 
                t.status === 'in_progress' ? { ...t, status: 'pending' } : t
            );

            if (!loadedProject.activityLog) loadedProject.activityLog = [];

            setProject(loadedProject);
        } catch (e) {
            console.error("Failed to load saved project", e);
        }
    }
  }, []);

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    localStorage.setItem('nexbuilder_config', JSON.stringify(newConfig));
    setCurrentView('home');
  };

  // Auto-Save Effect
  useEffect(() => {
    localStorage.setItem('nexbuilder_idea', projectIdea);
    if (project) {
        localStorage.setItem('nexbuilder_project', JSON.stringify(project));
        setLastSaved(Date.now());
    }
  }, [project, projectIdea]);

  const handleCreateProject = async () => {
    if (!projectIdea) return;
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const plan = await generateProjectPlan(projectIdea, config);
      
      if (plan.tasks.length === 0) {
        throw new Error("The AI returned an empty plan. Please try again with a more detailed description.");
      }

      const newProject: Project = {
        id: crypto.randomUUID(),
        name: plan.name || 'New Project',
        description: projectIdea,
        tasks: plan.tasks.map(t => ({ ...t, status: 'pending' })),
        files: [],
        activityLog: [],
        createdAt: Date.now()
      };
      setProject(newProject);
      setCurrentView('planner');
    } catch (e) {
      console.error(e);
      setErrorMsg((e as Error).message);
      // Don't switch view if failed
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetProject = () => {
    if (confirm("Are you sure you want to delete this project? This cannot be undone.")) {
        setProject(null);
        setProjectIdea('');
        localStorage.removeItem('nexbuilder_project');
        localStorage.removeItem('nexbuilder_idea');
        setCurrentView('home');
    }
  };

  const handleEditTask = (task: Task, newTitle: string, newDesc: string) => {
    setProject(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tasks: prev.tasks.map(t => 
          t.id === task.id ? { ...t, title: newTitle, description: newDesc } : t
        )
      };
    });
  };

  const handleSplitTask = async (task: Task) => {
    if (!project) return;
    setIsSplitting(true);
    
    setProject(prev => {
        if (!prev) return null;
        const logEntry: ActivityLogEntry = {
            id: crypto.randomUUID(),
            taskId: task.id,
            taskTitle: task.title,
            timestamp: Date.now(),
            status: 'split',
            details: 'Decomposing task into subtasks...'
        };
        return { ...prev, activityLog: [...(prev.activityLog || []), logEntry] };
    });
    
    try {
      const subTasksRaw = await decomposeTask(task, config);
      
      if (subTasksRaw.length === 0) {
        throw new Error("AI returned no subtasks.");
      }

      setProject(prev => {
        if (!prev) return null;
        
        const newTasks: Task[] = [];
        let previousId: string | null = null;
        
        subTasksRaw.forEach((st, index) => {
          const newId = crypto.randomUUID();
          const newTask: Task = {
            id: newId,
            title: st.title,
            description: st.description,
            agentRole: st.agentRole || 'developer',
            status: 'pending',
            dependencies: index === 0 ? task.dependencies : [previousId!]
          };
          newTasks.push(newTask);
          previousId = newId;
        });

        const lastNewTaskId = newTasks[newTasks.length - 1].id;

        const updatedTasks = prev.tasks.filter(t => t.id !== task.id).map(t => {
          if (t.dependencies.includes(task.id)) {
            return {
              ...t,
              dependencies: t.dependencies.map(d => d === task.id ? lastNewTaskId : d)
            };
          }
          return t;
        });

        const successLog: ActivityLogEntry = {
            id: crypto.randomUUID(),
            taskId: task.id,
            taskTitle: task.title,
            timestamp: Date.now(),
            status: 'split',
            details: `Successfully split into ${newTasks.length} subtasks.`
        };

        return {
          ...prev,
          tasks: [...updatedTasks, ...newTasks],
          activityLog: [...(prev.activityLog || []), successLog]
        };
      });

    } catch (e) {
      alert("Error splitting task: " + (e as Error).message);
    } finally {
      setIsSplitting(false);
    }
  };

  const handleExecuteTask = async (task: Task) => {
    if (!project) return;
    setIsExecuting(true);
    
    const startLog: ActivityLogEntry = {
        id: crypto.randomUUID(),
        taskId: task.id,
        taskTitle: task.title,
        timestamp: Date.now(),
        status: 'started'
    };

    setProject(prev => {
        if (!prev) return null;
        const updatedTasks = prev.tasks.map(t => 
            t.id === task.id ? { ...t, status: 'in_progress' as const } : t
        );
        return { 
            ...prev, 
            tasks: updatedTasks,
            activityLog: [...(prev.activityLog || []), startLog]
        };
    });

    try {
      const context = task.dependencies
        .map(depId => {
          const t = project!.tasks.find(pt => pt.id === depId);
          return t ? `Task "${t.title}":\n${t.output}` : '';
        })
        .join('\n\n');
      
      const fileContext = project.files.length > 0 
        ? `\nExisting Files:\n${project.files.map(f => `- ${f.path}`).join('\n')}` 
        : '';

      const output = await executeTask(task, context + fileContext, config);
      const newFiles = extractFilesFromOutput(output);

      setProject(prev => {
        if (!prev) return null;
        
        const updatedFiles = [...prev.files];
        newFiles.forEach(nf => {
          const index = updatedFiles.findIndex(f => f.path === nf.path);
          if (index >= 0) {
            updatedFiles[index] = nf;
          } else {
            updatedFiles.push(nf);
          }
        });

        const successLog: ActivityLogEntry = {
            id: crypto.randomUUID(),
            taskId: task.id,
            taskTitle: task.title,
            timestamp: Date.now(),
            status: 'completed',
            details: output.substring(0, 300) + (output.length > 300 ? '...' : '')
        };

        return {
          ...prev,
          files: updatedFiles,
          tasks: prev.tasks.map(t => 
            t.id === task.id ? { ...t, status: 'completed' as const, output } : t
          ),
          activityLog: [...(prev.activityLog || []), successLog]
        };
      });
    } catch (e) {
      setProject(prev => {
        if (!prev) return null;
        
        const failLog: ActivityLogEntry = {
            id: crypto.randomUUID(),
            taskId: task.id,
            taskTitle: task.title,
            timestamp: Date.now(),
            status: 'failed',
            details: (e as Error).message
        };

        return {
          ...prev,
          tasks: prev.tasks.map(t => 
            t.id === task.id ? { ...t, status: 'failed' as const } : t
          ),
          activityLog: [...(prev.activityLog || []), failLog]
        };
      });
      alert('Task execution failed: ' + (e as Error).message);
    } finally {
      setIsExecuting(false);
    }
  };

  // Self-Healing Feature: Fix Runtime Errors
  const handleAutoFixError = (errorMsg: string, stack: string) => {
    if (!project) return;
    
    // 1. Identify dependencies (last completed tasks are good candidates)
    const completedTasks = project.tasks.filter(t => t.status === 'completed');
    const lastTask = completedTasks.length > 0 ? completedTasks[completedTasks.length - 1] : null;
    const dependencies = lastTask ? [lastTask.id] : [];

    // 2. Create the Fix Task
    const fixTask: Task = {
      id: crypto.randomUUID(),
      title: `Fix Runtime Error: ${errorMsg.substring(0, 30)}...`,
      description: `The application crashed in the preview.\n\nERROR MESSAGE:\n${errorMsg}\n\nSTACK TRACE:\n${stack}\n\nINSTRUCTIONS:\nAnalyze the existing code, find the bug causing this error, and provide the fixed file content.`,
      agentRole: 'developer',
      status: 'pending',
      dependencies: dependencies
    };

    setProject(prev => {
        if (!prev) return null;
        const logEntry: ActivityLogEntry = {
            id: crypto.randomUUID(),
            taskId: fixTask.id,
            taskTitle: fixTask.title,
            timestamp: Date.now(),
            status: 'split', // Using split as 'created'
            details: 'Self-Healing Agent created a fix task for runtime error.'
        };
        return {
            ...prev,
            tasks: [...prev.tasks, fixTask],
            activityLog: [...(prev.activityLog || []), logEntry]
        };
    });

    // 3. Navigate to Builder to execute it
    setCurrentView('builder');
  };

  const handleFileUpdate = (path: string, newContent: string) => {
    setProject(prev => {
        if (!prev) return null;
        const updatedFiles = prev.files.map(f => 
            f.path === path ? { ...f, content: newContent } : f
        );
        return { ...prev, files: updatedFiles };
    });
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
          
          <div className="relative group max-w-xl mx-auto mb-6">
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

          {errorMsg && (
            <div className="max-w-xl mx-auto bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
               <AlertTriangle size={20} />
               <div className="text-sm font-medium">{errorMsg}</div>
               <button onClick={() => setErrorMsg(null)} className="ml-auto hover:text-white"><Trash2 size={14}/></button>
            </div>
          )}

          {/* Recovery hint if idea was loaded */}
          {projectIdea && !project && !errorMsg && (
             <div className="mt-4 flex items-center justify-center gap-2 text-slate-500 text-sm">
                <History size={14} /> Draft loaded from local storage
             </div>
          )}
        </div>
      );
    }

    if (project) {
      switch (currentView) {
        case 'home':
          return (
            <div className="max-w-4xl mx-auto mt-10">
              <div className="glass-panel p-8 rounded-3xl border-l-4 border-l-blue-500 relative overflow-hidden">
                <div className="absolute top-4 right-4 flex gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 text-slate-400 text-xs border border-slate-700">
                        <Save size={12} /> Auto-saved
                    </div>
                    <button 
                        onClick={handleResetProject}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider"
                    >
                        <Trash2 size={14} /> Reset Project
                    </button>
                </div>

                <h2 className="text-3xl font-bold mb-2">{project.name}</h2>
                <p className="text-slate-400 mb-6 max-w-2xl">{project.description}</p>
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
                <div className="flex items-center gap-4">
                  {isSplitting && (
                    <div className="flex items-center gap-2 text-purple-400 text-sm bg-purple-500/10 px-3 py-1 rounded-full animate-pulse">
                      <Scissors size={14} /> Splitting Task...
                    </div>
                  )}
                  {isExecuting && (
                    <div className="flex items-center gap-2 text-blue-400 text-sm bg-blue-500/10 px-3 py-1 rounded-full animate-pulse">
                      <Terminal size={14} /> Agent is working...
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <BuilderBoard 
                  tasks={project.tasks} 
                  onExecute={handleExecuteTask} 
                  onSplit={handleSplitTask}
                  onEdit={handleEditTask}
                  isExecuting={isExecuting}
                  isSplitting={isSplitting}
                />
              </div>
            </div>
          );
        case 'preview':
          return (
             <CodePreview 
               project={project} 
               onFixError={handleAutoFixError} 
               onUpdateFile={handleFileUpdate}
             />
          );
        case 'history':
          return <HistoryView project={project} />;
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