import React from 'react';
import { Project, ActivityLogEntry } from '../types';
import { History, CheckCircle, XCircle, PlayCircle, Clock, Scissors } from 'lucide-react';

interface HistoryViewProps {
  project: Project;
}

const HistoryView: React.FC<HistoryViewProps> = ({ project }) => {
  // Sort log by timestamp descending (newest first)
  const sortedLog = [...(project.activityLog || [])].sort((a, b) => b.timestamp - a.timestamp);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatusIcon = (status: ActivityLogEntry['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} className="text-emerald-400" />;
      case 'failed': return <XCircle size={16} className="text-red-400" />;
      case 'started': return <PlayCircle size={16} className="text-blue-400" />;
      case 'split': return <Scissors size={16} className="text-purple-400" />;
      default: return <Clock size={16} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: ActivityLogEntry['status']) => {
    switch (status) {
      case 'completed': return 'border-emerald-500/30 bg-emerald-500/5';
      case 'failed': return 'border-red-500/30 bg-red-500/5';
      case 'started': return 'border-blue-500/30 bg-blue-500/5';
      case 'split': return 'border-purple-500/30 bg-purple-500/5';
      default: return 'border-slate-700 bg-slate-800/30';
    }
  };

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <History className="text-orange-400" /> Execution History
        </h2>
        <div className="text-sm text-slate-500 font-mono">
           {sortedLog.length} Events Recorded
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-3xl p-6 overflow-hidden flex flex-col">
        {sortedLog.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 space-y-4">
             <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center">
               <History size={32} />
             </div>
             <p>No activity recorded yet.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 relative">
            {/* Vertical Line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-800/50" />

            {sortedLog.map((entry) => (
              <div key={entry.id} className="relative pl-12">
                 {/* Timeline Dot */}
                 <div className={`
                    absolute left-[11px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[#0f172a] 
                    ${entry.status === 'completed' ? 'bg-emerald-500' : 
                      entry.status === 'failed' ? 'bg-red-500' :
                      entry.status === 'split' ? 'bg-purple-500' : 
                      'bg-blue-500'}
                 `} />

                 <div className={`p-4 rounded-xl border ${getStatusColor(entry.status)} transition-all hover:bg-slate-800/40`}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            {getStatusIcon(entry.status)}
                            <span className="font-bold text-sm text-slate-200">{entry.taskTitle}</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">{formatTime(entry.timestamp)}</span>
                    </div>

                    <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2 opacity-70">
                        {entry.status === 'split' ? 'Task Modification' : 'Task Execution'}
                    </div>

                    {entry.details && (
                        <div className="mt-2 bg-black/30 rounded p-3 font-mono text-xs text-slate-300 border border-slate-700/50 overflow-x-auto whitespace-pre-wrap">
                            {entry.details}
                        </div>
                    )}
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;