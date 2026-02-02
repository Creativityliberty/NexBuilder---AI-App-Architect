import React from 'react';
import { Task } from '../types';
import { Play, CheckCircle, Lock, AlertCircle, RefreshCw } from 'lucide-react';

interface BuilderBoardProps {
  tasks: Task[];
  onExecute: (task: Task) => void;
  isExecuting: boolean;
}

const BuilderBoard: React.FC<BuilderBoardProps> = ({ tasks, onExecute, isExecuting }) => {
  
  const TaskCard: React.FC<{ task: Task }> = ({ task }) => {
    const isReady = task.status === 'pending' && 
      task.dependencies.every(depId => tasks.find(t => t.id === depId)?.status === 'completed');
    
    const isCompleted = task.status === 'completed';
    const isRunning = task.status === 'in_progress';

    return (
      <div className={`
        relative p-5 rounded-2xl border transition-all duration-300 group
        ${isCompleted ? 'bg-emerald-950/20 border-emerald-500/30' : 
          isRunning ? 'bg-blue-950/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 
          !isReady ? 'bg-slate-900/50 border-slate-800 opacity-60' :
          'bg-slate-800/50 border-slate-700 hover:border-slate-500'}
      `}>
        <div className="flex justify-between items-start mb-3">
          <span className={`
            px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider
            ${task.agentRole === 'architect' ? 'bg-purple-500/20 text-purple-400' :
              task.agentRole === 'developer' ? 'bg-blue-500/20 text-blue-400' :
              'bg-orange-500/20 text-orange-400'}
          `}>
            {task.agentRole}
          </span>
          
          {isCompleted && <CheckCircle size={18} className="text-emerald-500" />}
          {isRunning && <RefreshCw size={18} className="text-blue-500 animate-spin" />}
          {!isReady && !isCompleted && !isRunning && <Lock size={18} className="text-slate-600" />}
        </div>

        <h3 className="font-semibold text-slate-200 mb-2">{task.title}</h3>
        <p className="text-xs text-slate-400 line-clamp-2 mb-4">{task.description}</p>

        {isReady && !isRunning && !isExecuting && (
          <button 
            onClick={() => onExecute(task)}
            className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-blue-600 text-white py-2 rounded-lg text-xs font-bold transition-colors"
          >
            <Play size={12} /> Execute Task
          </button>
        )}
        
        {task.output && (
           <div className="mt-3 pt-3 border-t border-slate-700/50">
             <div className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Output Preview</div>
             <div className="text-xs font-mono text-slate-300 bg-black/30 p-2 rounded truncate">
                {task.output.substring(0, 50)}...
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
    <div className="grid grid-cols-3 gap-6 h-full overflow-hidden">
      {/* Column 1: Backlog */}
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-500" /> Pending
        </h3>
        <div className="space-y-4 overflow-y-auto pr-2 pb-20 scrollbar-hide">
          {pending.length === 0 && <div className="text-slate-600 text-sm italic">No pending tasks</div>}
          {pending.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      </div>

      {/* Column 2: In Progress */}
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" /> In Progress
        </h3>
        <div className="space-y-4 overflow-y-auto pr-2 pb-20">
          {inProgress.length === 0 && <div className="p-8 border-2 border-dashed border-slate-800 rounded-2xl text-center text-slate-600 text-sm">Waiting for execution...</div>}
          {inProgress.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      </div>

      {/* Column 3: Completed */}
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" /> Completed
        </h3>
        <div className="space-y-4 overflow-y-auto pr-2 pb-20">
          {completed.length === 0 && <div className="text-slate-600 text-sm italic">No completed tasks</div>}
          {completed.map(t => <TaskCard key={t.id} task={t} />)}
        </div>
      </div>
    </div>
  );
};

export default BuilderBoard;