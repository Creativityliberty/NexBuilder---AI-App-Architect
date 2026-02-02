import React, { useEffect, useState, useRef } from 'react';
import { Task } from '../types';
import { Info, GitCommit, User, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface DAGVisualizerProps {
  tasks: Task[];
  activeTaskId?: string;
}

const DAGVisualizer: React.FC<DAGVisualizerProps> = ({ tasks, activeTaskId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (tasks.length === 0) return;

    const generateMermaid = async () => {
      // Switch to Left-Right graph for better timeline visualization
      let definition = 'graph LR\n';
      
      // Cyberpunk/Modern Theme Definitions
      definition += '%%{init: {\'theme\': \'base\', \'themeVariables\': { \'primaryColor\': \'#1e293b\', \'primaryTextColor\': \'#f8fafc\', \'primaryBorderColor\': \'#475569\', \'lineColor\': \'#64748b\', \'secondaryColor\': \'#0f172a\', \'tertiaryColor\': \'#1e1e1e\'}}}%%\n';

      // Advanced Class Definitions
      definition += 'classDef pending fill:#0f172a,stroke:#334155,stroke-width:1px,color:#94a3b8,rx:5,ry:5;\n';
      definition += 'classDef in_progress fill:#172554,stroke:#3b82f6,stroke-width:2px,color:#93c5fd,stroke-dasharray: 5 5,rx:5,ry:5;\n';
      definition += 'classDef completed fill:#022c22,stroke:#10b981,stroke-width:2px,color:#6ee7b7,rx:5,ry:5;\n';
      definition += 'classDef blocked fill:#450a0a,stroke:#ef4444,stroke-width:2px,color:#fca5a5,rx:5,ry:5;\n';
      
      // Agent Role Specific Styles (Applied via ID suffix hacks or just stick to status for now, lets use status for clarity)

      tasks.forEach(task => {
        // Clean ID for mermaid
        const cleanId = task.id.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Add Icons or formatting to label based on Role
        let roleIcon = "🔧";
        if (task.agentRole === 'architect') roleIcon = "📐";
        if (task.agentRole === 'reviewer') roleIcon = "👁️";
        
        let label = `"${roleIcon} ${task.title}"`;
        
        // Add status class
        let className = 'pending';
        if (task.status === 'in_progress') className = 'in_progress';
        if (task.status === 'completed') className = 'completed';
        if (task.status === 'blocked') className = 'blocked';

        // Add Click Interaction via Clickable Class
        definition += `${cleanId}[${label}]:::${className}\n`;
        definition += `click ${cleanId} call window.handleTaskClick('${task.id}')\n`;

        // Dependencies
        task.dependencies.forEach(depId => {
          const cleanDepId = depId.replace(/[^a-zA-Z0-9]/g, '_');
          if (tasks.find(t => t.id === depId)) {
            definition += `${cleanDepId} --> ${cleanId}\n`;
          }
        });
      });

      try {
        const { svg } = await (window as any).mermaid.render(`dag-${Date.now()}`, definition);
        setSvgContent(svg);
      } catch (e) {
        console.error("Mermaid render error", e);
        setSvgContent('<div class="text-red-500 p-4">Error rendering graph</div>');
      }
    };

    generateMermaid();
  }, [tasks, activeTaskId]);

  // Global handler for Mermaid clicks
  useEffect(() => {
    (window as any).handleTaskClick = (taskId: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (task) setSelectedTask(task);
    };
    return () => {
      delete (window as any).handleTaskClick;
    };
  }, [tasks]);

  return (
    <div className="flex h-full gap-4">
      {/* Graph Area */}
      <div className="flex-1 glass-panel rounded-3xl p-6 min-h-[400px] flex items-center justify-center bg-slate-900/50 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-400 font-mono">
            Graph Mode: LR (Timeline)
        </div>
        
        {tasks.length === 0 ? (
          <div className="text-slate-500 text-center">
            <p>No tasks defined yet.</p>
          </div>
        ) : (
          <div 
            ref={containerRef}
            className="w-full h-full overflow-auto flex items-center justify-center cursor-move active:cursor-grabbing"
            dangerouslySetInnerHTML={{ __html: svgContent }} 
            onClick={(e) => {
                // Basic pan logic could go here, or just rely on overflow-auto
            }}
          />
        )}
      </div>

      {/* Task Inspector Panel */}
      <div className="w-80 glass-panel rounded-3xl p-0 flex flex-col border-l border-slate-700/50 overflow-hidden transition-all duration-300">
        <div className="p-5 border-b border-slate-700/50 bg-slate-900/50">
            <h3 className="font-bold text-white flex items-center gap-2">
                <Info size={18} className="text-blue-400" /> Task Inspector
            </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5">
            {selectedTask ? (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Task ID</div>
                        <div className="font-mono text-xs text-slate-600 break-all">{selectedTask.id}</div>
                    </div>

                    <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Title</div>
                        <h4 className="text-lg font-bold text-white leading-tight">{selectedTask.title}</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                                <User size={12} /> Agent
                            </div>
                            <div className="text-blue-300 font-medium capitalize">{selectedTask.agentRole}</div>
                         </div>
                         <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                                <Clock size={12} /> Status
                            </div>
                            <div className={`font-medium capitalize ${
                                selectedTask.status === 'completed' ? 'text-emerald-400' :
                                selectedTask.status === 'in_progress' ? 'text-blue-400' :
                                selectedTask.status === 'failed' ? 'text-red-400' :
                                'text-slate-400'
                            }`}>
                                {selectedTask.status.replace('_', ' ')}
                            </div>
                         </div>
                    </div>

                    <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Description</div>
                        <p className="text-sm text-slate-300 leading-relaxed bg-slate-800/30 p-3 rounded-lg border border-slate-800">
                            {selectedTask.description}
                        </p>
                    </div>

                    <div>
                         <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Dependencies</div>
                         {selectedTask.dependencies.length === 0 ? (
                             <div className="text-xs text-slate-600 italic">No dependencies</div>
                         ) : (
                             <div className="space-y-2">
                                 {selectedTask.dependencies.map(depId => {
                                     const dep = tasks.find(t => t.id === depId);
                                     return (
                                         <div key={depId} className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800">
                                             <GitCommit size={12} />
                                             <span className="truncate flex-1">{dep?.title || depId}</span>
                                             {dep?.status === 'completed' ? <CheckCircle size={12} className="text-emerald-500" /> : <Clock size={12} />}
                                         </div>
                                     )
                                 })}
                             </div>
                         )}
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-4 opacity-50">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                        <GitCommit size={32} />
                    </div>
                    <p className="text-sm max-w-[200px]">Click on a node in the graph to view its details.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default DAGVisualizer;