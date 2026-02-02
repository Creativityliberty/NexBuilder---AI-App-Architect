import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import DAGVisualizer from './components/DAGVisualizer';
import BuilderBoard from './components/BuilderBoard';
import CodePreview from './components/CodePreview';
import HistoryView from './components/HistoryView';
import { ViewMode, AppConfig, Project, Task, ActivityLogEntry } from './types';
import { generateProjectPlan, executeTask, extractFilesFromOutput, decomposeTask } from './services/aiService';
import { saveProject, loadProject, saveConfig, loadConfig, saveIdea, loadIdea, clearProject } from './services/storageService';
import { 
  Sparkles, Terminal, ArrowRight, Activity, GitMerge, Trash2, 
  History, Save, Scissors, AlertTriangle, Layout, BarChart3, Kanban, 
  Paperclip, Mic, FileText, Image, X
} from 'lucide-react';

const TEMPLATES = [
  {
    title: "SaaS Landing Page",
    description: "Modern high-converting landing page with Hero, Features, Pricing, and Testimonials.",
    icon: Layout,
    prompt: "Create a modern, responsive SaaS landing page for an AI analytics tool. Include a glassmorphism Hero section with a call-to-action, a 3-column Feature grid using Lucide icons, a Pricing table with monthly/yearly toggle, and a footer. Use a dark theme with blue/purple gradients and Inter font."
  },
  {
    title: "Admin Dashboard",
    description: "Data-dense dashboard with sidebar navigation, stats cards, and charts.",
    icon: BarChart3,
    prompt: "Build a responsive Admin Dashboard with a collapsible sidebar navigation. The main content should have a 'Stats Overview' row (Users, Revenue, Bounce Rate), followed by a data table showing recent transactions with status badges. Include a placeholder for a line chart using CSS or SVG."
  },
  {
    title: "Kanban Board",
    description: "Trello-style task management with drag-and-drop capabilities.",
    icon: Kanban,
    prompt: "Create a functional Kanban board application. It should have 3 columns: 'To Do', 'In Progress', 'Done'. Allow users to add new cards to 'To Do', delete cards, and move them between columns. Persist the state using local storage inside the generated app."
  }
];

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
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);
  
  // Attachments
  const [attachments, setAttachments] = useState<{name: string, content: string, type: 'text' | 'image'}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialization: Load config and state from IndexedDB
  useEffect(() => {
    const init = async () => {
        try {
            const savedConfig = await loadConfig();
            if (savedConfig) setConfig(savedConfig);

            const savedIdea = await loadIdea();
            if (savedIdea) setProjectIdea(savedIdea);

            const savedProject = await loadProject();
            if (savedProject) {
                // CRASH RECOVERY
                savedProject.tasks = savedProject.tasks.map(t => 
                    t.status === 'in_progress' ? { ...t, status: 'pending' } : t
                );
                if (!savedProject.activityLog) savedProject.activityLog = [];
                if (!savedProject.packages) savedProject.packages = [];
                setProject(savedProject);
            }
        } catch (e) {
            console.error("Failed to load storage", e);
        } finally {
            setIsLoadingStorage(false);
        }
    };
    init();
  }, []);

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    saveConfig(newConfig);
    setCurrentView('home');
  };

  useEffect(() => {
    if (!isLoadingStorage) {
        saveIdea(projectIdea);
        if (project) {
            saveProject(project);
            setLastSaved(Date.now());
        }
    }
  }, [project, projectIdea, isLoadingStorage]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (file.type.startsWith('image/')) {
                // Keep base64 for images (but truncate for display?)
                setAttachments(prev => [...prev, { name: file.name, content: content, type: 'image' }]);
            } else {
                setAttachments(prev => [...prev, { name: file.name, content: content, type: 'text' }]);
            }
        };
        if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateProject = async (overrideIdea?: string) => {
    const ideaToUse = overrideIdea || projectIdea;
    if (!ideaToUse) return;
    
    if (overrideIdea) setProjectIdea(overrideIdea);

    setIsGenerating(true);
    setErrorMsg(null);
    try {
      // Construct full context with files
      let fullPrompt = ideaToUse;
      if (attachments.length > 0) {
        fullPrompt += "\n\nATTACHED CONTEXT FILES:";
        attachments.forEach(att => {
            if (att.type === 'text') {
                fullPrompt += `\n\n--- FILE: ${att.name} ---\n${att.content}\n--- END FILE ---\n`;
            } else {
                fullPrompt += `\n\n[Image Attachment: ${att.name} included]`;
                // In a real multimodal implementation, we would pass the base64 separately to the model contents array
                // For this simplified text-based prompt function, we assume the user describes the image or we use a model that supports inline text context.
                // However, gemini-flash supports images. Ideally generateProjectPlan should accept an array of parts.
                // For now, we append text context.
            }
        });
      }

      const plan = await generateProjectPlan(fullPrompt, config);
      
      if (plan.tasks.length === 0) {
        throw new Error("The AI returned an empty plan.");
      }

      const newProject: Project = {
        id: crypto.randomUUID(),
        name: plan.name || 'New Project',
        description: ideaToUse,
        tasks: plan.tasks.map(t => ({ ...t, status: 'pending' })),
        files: [],
        packages: plan.packages || [],
        activityLog: [],
        createdAt: Date.now()
      };
      setProject(newProject);
      setCurrentView('planner');
      setAttachments([]); // Clear attachments after creation
    } catch (e) {
      console.error(e);
      setErrorMsg((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetProject = async () => {
    if (confirm("Are you sure you want to delete this project? This cannot be undone.")) {
        setProject(null);
        setProjectIdea('');
        await clearProject();
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

  const handleAddPackage = (pkg: string) => {
    setProject(prev => {
        if (!prev) return null;
        if (prev.packages.includes(pkg)) return prev;
        return { ...prev, packages: [...prev.packages, pkg] };
    });
  };

  const handleRemovePackage = (pkg: string) => {
    setProject(prev => {
        if (!prev) return null;
        return { ...prev, packages: prev.packages.filter(p => p !== pkg) };
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
      
      if (subTasksRaw.length === 0) throw new Error("AI returned no subtasks.");

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

      const output = await executeTask(task, context + fileContext, project.packages, config);
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

  const handleAutoFixError = (errorMsg: string, stack: string) => {
    if (!project) return;
    const completedTasks = project.tasks.filter(t => t.status === 'completed');
    const lastTask = completedTasks.length > 0 ? completedTasks[completedTasks.length - 1] : null;
    const dependencies = lastTask ? [lastTask.id] : [];

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
            status: 'split',
            details: 'Self-Healing Agent created a fix task for runtime error.'
        };
        return {
            ...prev,
            tasks: [...prev.tasks, fixTask],
            activityLog: [...(prev.activityLog || []), logEntry]
        };
    });
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
    if (isLoadingStorage) {
        return (
            <div className="flex items-center justify-center h-screen text-slate-500">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin"></div>
                    <p>Loading Workspace...</p>
                </div>
            </div>
        );
    }

    if (currentView === 'settings') {
      return <SettingsModal config={config} onSave={handleSaveConfig} />;
    }

    if (!project && currentView !== 'settings') {
      return (
        <div className="max-w-4xl mx-auto mt-12 text-center animate-in fade-in duration-700 px-6 pb-20">
          <div className="inline-block p-4 rounded-full bg-blue-500/10 mb-6 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <Sparkles size={40} className="text-blue-400" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 tracking-tight">
            What shall we build today?
          </h1>
          <p className="text-slate-400 text-lg mb-8 max-w-lg mx-auto leading-relaxed">
            Describe your application idea, or choose a template.
          </p>
          
          <div className="relative group max-w-2xl mx-auto mb-12 text-left">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex flex-col bg-slate-900 rounded-2xl p-4 border border-slate-700 shadow-2xl">
              <textarea 
                value={projectIdea}
                onChange={(e) => setProjectIdea(e.target.value)}
                placeholder="e.g. A React Kanban board with drag and drop..."
                className="w-full h-32 bg-transparent border-none outline-none text-white text-lg placeholder-slate-600 resize-none font-sans leading-relaxed"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCreateProject();
                    }
                }}
              />
              
              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-800 rounded-lg p-2 text-xs border border-slate-700 shrink-0">
                            {att.type === 'image' ? <Image size={12} className="text-purple-400" /> : <FileText size={12} className="text-blue-400" />}
                            <span className="truncate max-w-[100px]">{att.name}</span>
                            <button onClick={() => removeAttachment(i)} className="hover:text-red-400"><X size={12}/></button>
                        </div>
                    ))}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <div className="flex gap-2">
                     <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                     <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-blue-400 transition-colors tooltip"
                        title="Attach files or images"
                     >
                        <Paperclip size={20} />
                     </button>
                     <button 
                         className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-purple-400 transition-colors"
                         title="Voice Input (Coming Soon)"
                     >
                        <Mic size={20} />
                     </button>
                </div>

                <button 
                    onClick={() => handleCreateProject()}
                    disabled={isGenerating || !projectIdea}
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-2.5 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

          {/* Project Templates */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">Or Start with a Template</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TEMPLATES.map((template, idx) => (
                    <button 
                        key={idx}
                        onClick={() => handleCreateProject(template.prompt)}
                        className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-2xl p-6 text-left transition-all hover:-translate-y-1 group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mb-4 group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
                            <template.icon size={24} className="text-slate-400 group-hover:text-blue-400" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-200 mb-2">{template.title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">{template.description}</p>
                    </button>
                ))}
            </div>
          </div>

          {errorMsg && (
            <div className="max-w-xl mx-auto mt-8 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
               <AlertTriangle size={20} />
               <div className="text-sm font-medium">{errorMsg}</div>
               <button onClick={() => setErrorMsg(null)} className="ml-auto hover:text-white"><Trash2 size={14}/></button>
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
                  packages={project.packages}
                  config={config}
                  onExecute={handleExecuteTask} 
                  onSplit={handleSplitTask}
                  onEdit={handleEditTask}
                  onAddPackage={handleAddPackage}
                  onRemovePackage={handleRemovePackage}
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