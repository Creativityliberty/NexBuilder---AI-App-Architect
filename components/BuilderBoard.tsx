import React, { useState } from 'react';
import { Task } from '../types';
import { Play, CheckCircle, Lock, AlertCircle, RefreshCw, Scissors, Pencil, X, Save } from 'lucide-react';

interface BuilderBoardProps {
  tasks: Task[];
  onExecute: (task: Task) => void;
  onSplit: (task: Task) => void;
  onEdit: (task: Task, newTitle: string, newDesc: string) => void;
  isExecuting: boolean;
  isSplitting: boolean;
}

const BuilderBoard: React.FC<BuilderBoardProps> = ({ 
  tasks, 
  onExecute, 
  onSplit, 
  onEdit, 
  isExecuting,
  isSplitting 
}) => {
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

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
             {/* Action Buttons for Pending Tasks */}
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
        
        {task.output && (
           <div className="mt-2 pt-2 border-t border-slate-700/50">
             <div className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Output Preview</div>
             <div className="text-xs font-mono text-slate-300 bg-black/30 p-1.5 rounded truncate opacity-70">
                {task.output.substring(0, 40)}...
             </div>
           </div>
        )}
      </div>
    );
  };

  const pending = tasks.filter(t => t.status === 'pending' || t.status === 'blocked');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const completed = tasks.filter(t => t.status === 'completed');

  return (
    <>
      <div className="grid grid-cols-3 gap-6 h-full overflow-hidden pb-2">
        {/* Column 1: Backlog */}
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

        {/* Column 2: In Progress */}
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

        {/* Column 3: Completed */}
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

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Edit Task Instructions</h3>
              <button onClick={() => setEditingTask(null)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs uppercase font-bold text-slate-500 mb-1.5 block">Task Title</label>
                <input 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-bold text-slate-500 mb-1.5 block">Instructions</label>
                <textarea 
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none text-sm leading-relaxed"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
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