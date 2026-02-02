
import React, { useState } from 'react';
import { Task, AppConfig } from '../types';
import { Play, CheckCircle, Lock, AlertCircle, RefreshCw, Scissors, Pencil, X, Save, Box, Plus, Trash2, Wand2, Zap, FastForward } from 'lucide-react';
import { refineTaskDescription } from '../services/aiService';

interface BuilderBoardProps {
  tasks: Task[];
  packages: string[];
  config: AppConfig;
  onExecute: (task: Task) => void;
  onSplit: (task: Task) => void;
  onEdit: (task: Task, newTitle: string, newDesc: string) => void;
  onAddPackage: (pkg: string) => void;
  onRemovePackage: (pkg: string) => void;
  isExecuting: boolean;
  isSplitting: boolean;
}

const BuilderBoard: React.FC<BuilderBoardProps> = ({ 
  tasks, 
  packages,
  config,
  onExecute, 
  onSplit, 
  onEdit, 
  onAddPackage,
  onRemovePackage,
  isExecuting,
  isSplitting 
}) => {
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [newPkgName, setNewPkgName] = useState("");
  const [showPkgInput, setShowPkgInput] = useState(false);

  // Auto-Pilot Logic
  const pendingReadyTasks = tasks.filter(t => 
    t.status === 'pending' && 
    t.dependencies.every(depId => tasks.find(pt => pt.id === depId)?.status === 'completed')
  );

  const handleBatchRun = () => {
     if (pendingReadyTasks.length > 0) {
        // We trigger the first one, the parent App should ideally handle the queue, 
        // but for now, let's trigger the first available.
        // To do true batch, we'd need to change App.tsx to accept a queue. 
        // For this UI iteration, let's execute the first ready task and the user can click again or we loop in App.
        onExecute(pendingReadyTasks[0]);
     }
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description);
  };

  const handleSaveEdit = () => {
    if (editingTask) {
      onEdit(editingTask, editTitle, editDesc);
      setEditingTask(null);
    }
  };

  const handleAiRefine = async () => {
    if (!editDesc) return;
    setIsRefining(true);
    try {
        const refined = await refineTaskDescription(editDesc, editTitle, config);
        setEditDesc(refined);
    } catch (e) {
        alert("Failed to refine: " + (e as Error).message);
    } finally {
        setIsRefining(false);
    }
  };

  const handleAddPkg = () => {
    if (newPkgName) {
        onAddPackage(newPkgName);
        setNewPkgName("");
        setShowPkgInput(false);
    }
  };

  const TaskCard: React.FC<{ task: Task }> = ({ task }) => {
    const isReady = task.status === 'pending' && 
      task.dependencies.every(depId => tasks.find(t => t.id === depId)?.status === 'completed');
    
    const isCompleted = task.status === 'completed';
    const isRunning = task.status === 'in_progress';
    const isPending = task.status === 'pending' || task.status === 'blocked';

    return (
      <div className={`
        relative p-4 rounded-xl border transition-all duration-300 group shadow-sm hover:shadow-md
        ${isCompleted ? 'bg-emerald-950/20 border-emerald-500/30' : 
          isRunning ? 'bg-blue-950/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 
          !isReady ? 'bg-slate-900/50 border-slate-800 opacity-60' :
          'bg-slate-800/50 border-slate-700 hover:border-slate-500'}
      `}>
        <div className="flex justify-between items-start mb-2">
          <span className={`
            px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider
            ${task.agentRole === 'architect' ? 'bg-purple-500/20 text-purple-400' :
              task.agentRole === 'developer' ? 'bg-blue-500/20 text-blue-400' :
              'bg-orange-500/20 text-orange-400'}
          `}>
            {task.agentRole}
          </span>
          
          <div className="flex gap-2">
             {isPending && !isSplitting && (
               <>
                <button 
                  onClick={(e) => { e.stopPropagation(); onSplit(task); }}
                  className="text-slate-500 hover:text-purple-400 transition-colors p-1 hover:bg-slate-700/50 rounded"
                  title="Split into smaller tasks"
                >
                  <Scissors size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); openEdit(task); }}
                  className="text-slate-500 hover:text-blue-400 transition-colors p-1 hover:bg-slate-700/50 rounded"
                  title="Edit task instructions"
                >
                  <Pencil size={14} />
                </button>
               </>
             )}

            {isCompleted && <CheckCircle size={16} className="text-emerald-500" />}
            {isRunning && <RefreshCw size={16} className="text-blue-500 animate-spin" />}
            {!isReady && !isCompleted && !isRunning && <Lock size={16} className="text-slate-600" />}
          </div>
        </div>

        <h3 className="font-semibold text-slate-200 text-sm mb-1 leading-tight">{task.title}</h3>
        <p className="text-xs text-slate-400 line-clamp-3 mb-3 leading-relaxed">{task.description}</p>

        {isReady && !isRunning && !isExecuting && !isSplitting && (
          <button 
            onClick={() => onExecute(task)}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-blue-600 text-white py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            <Play size={12} /> Execute Task
          </button>
        )}
      </div>
    );
  };

  const pending = tasks.filter(t => t.status === 'pending' || t.status === 'blocked');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const completed = tasks.filter(t => t.status === 'completed');

  return (
    <>
      <div className="flex flex-col h-full gap-4">
        {/* Top Control Bar */}
        <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
            {/* Package Manager */}
            <div className="flex items-center gap-3">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Box size={14} /> Dependencies
                </div>
                <div className="flex gap-2 items-center">
                    {packages.map(pkg => (
                        <div key={pkg} className="px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300 border border-slate-700 flex items-center gap-2">
                            {pkg}
                            <button onClick={() => onRemovePackage(pkg)} className="hover:text-red-400"><X size={10}/></button>
                        </div>
                    ))}
                    {showPkgInput ? (
                        <div className="flex items-center gap-1">
                            <input 
                                autoFocus
                                className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs text-white w-24 outline-none"
                                placeholder="pkg name"
                                value={newPkgName}
                                onChange={e => setNewPkgName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddPkg()}
                            />
                            <button onClick={handleAddPkg} className="text-green-400"><CheckCircle size={14} /></button>
                            <button onClick={() => setShowPkgInput(false)} className="text-slate-500"><X size={14} /></button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setShowPkgInput(true)}
                            className="w-6 h-6 rounded-full border border-dashed border-slate-600 flex items-center justify-center text-slate-500 hover:text-white hover:border-white transition-colors"
                        >
                            <Plus size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Auto Pilot */}
            {pendingReadyTasks.length > 0 && !isExecuting && (
                <button 
                    onClick={handleBatchRun}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow-lg animate-pulse"
                >
                    <FastForward size={14} /> Auto-Pilot ({pendingReadyTasks.length} Ready)
                </button>
            )}
        </div>

        <div className="grid grid-cols-3 gap-6 flex-1 min-h-0 pb-2">
            {/* Columns (Pending, Progress, Completed) */}
            <div className="flex flex-col h-full min-h-0 bg-slate-900/30 rounded-2xl border border-slate-800/50">
            <div className="p-4 border-b border-slate-800/50 backdrop-blur-sm sticky top-0 z-10 rounded-t-2xl">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-500" /> Pending ({pending.length})
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {pending.length === 0 && <div className="text-slate-600 text-sm italic text-center mt-10">No pending tasks</div>}
                {pending.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
            </div>

            <div className="flex flex-col h-full min-h-0 bg-blue-950/10 rounded-2xl border border-blue-900/30">
            <div className="p-4 border-b border-blue-900/30 backdrop-blur-sm sticky top-0 z-10 rounded-t-2xl">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" /> In Progress ({inProgress.length})
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {inProgress.length === 0 && <div className="mt-10 p-4 border-2 border-dashed border-slate-800 rounded-xl text-center text-slate-600 text-xs">Waiting for execution...</div>}
                {inProgress.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
            </div>

            <div className="flex flex-col h-full min-h-0 bg-emerald-950/10 rounded-2xl border border-emerald-900/30">
            <div className="p-4 border-b border-emerald-900/30 backdrop-blur-sm sticky top-0 z-10 rounded-t-2xl">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" /> Completed ({completed.length})
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {completed.length === 0 && <div className="text-slate-600 text-sm italic text-center mt-10">No completed tasks</div>}
                {completed.map(t => <TaskCard key={t.id} task={t} />)}
            </div>
            </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Edit Task Instructions</h3>
              <button onClick={() => setEditingTask(null)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-5 flex-1 overflow-y-auto pr-2">
              <div>
                <label className="text-xs uppercase font-bold text-slate-500 mb-1.5 block">Task Title</label>
                <input 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs uppercase font-bold text-slate-500 block">Detailed Instructions</label>
                    <button 
                        onClick={handleAiRefine}
                        disabled={isRefining}
                        className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 disabled:opacity-50"
                    >
                        {isRefining ? <RefreshCw size={12} className="animate-spin" /> : <Wand2 size={12} />}
                        Refine with AI
                    </button>
                </div>
                <textarea 
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full h-64 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none text-sm leading-relaxed font-mono"
                  placeholder="Describe what needs to be done..."
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button 
                onClick={() => setEditingTask(null)}
                className="px-5 py-2.5 text-slate-400 hover:text-white font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-all transform hover:scale-[1.02]"
              >
                <Save size={18} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BuilderBoard;
