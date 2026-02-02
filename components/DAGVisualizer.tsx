import React, { useEffect, useState, useRef } from 'react';
import { Task } from '../types';

interface DAGVisualizerProps {
  tasks: Task[];
  activeTaskId?: string;
}

const DAGVisualizer: React.FC<DAGVisualizerProps> = ({ tasks, activeTaskId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    if (tasks.length === 0) return;

    const generateMermaid = async () => {
      let definition = 'graph TD\n';
      
      // Define styles
      definition += 'classDef pending fill:#1e293b,stroke:#475569,stroke-width:2px,color:#94a3b8;\n';
      definition += 'classDef in_progress fill:#172554,stroke:#3b82f6,stroke-width:3px,color:#60a5fa,stroke-dasharray: 5 5;\n';
      definition += 'classDef completed fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#34d399;\n';
      definition += 'classDef blocked fill:#450a0a,stroke:#ef4444,stroke-width:2px,color:#f87171;\n';

      tasks.forEach(task => {
        // Clean ID for mermaid
        const cleanId = task.id.replace(/[^a-zA-Z0-9]/g, '_');
        let label = `"${task.title}"`;
        
        // Add status class
        let className = 'pending';
        if (task.status === 'in_progress') className = 'in_progress';
        if (task.status === 'completed') className = 'completed';
        if (task.status === 'blocked') className = 'blocked';

        definition += `${cleanId}[${label}]:::${className}\n`;

        // Dependencies
        task.dependencies.forEach(depId => {
          const cleanDepId = depId.replace(/[^a-zA-Z0-9]/g, '_');
          // Only link if dependency exists in current list
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

  return (
    <div className="w-full overflow-auto glass-panel rounded-3xl p-6 min-h-[400px] flex items-center justify-center bg-slate-900/50">
      {tasks.length === 0 ? (
        <div className="text-slate-500 text-center">
          <p>No tasks defined yet.</p>
        </div>
      ) : (
        <div 
          ref={containerRef}
          className="w-full h-full flex justify-center"
          dangerouslySetInnerHTML={{ __html: svgContent }} 
        />
      )}
    </div>
  );
};

export default DAGVisualizer;