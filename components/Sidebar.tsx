import React from 'react';
import { ViewMode } from '../types';
import { 
  Home, 
  GitMerge, 
  Hammer, 
  Settings, 
  Hexagon,
  Eye
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const NavItem = ({ view, icon: Icon, label }: { view: ViewMode; icon: any; label: string }) => (
    <button
      onClick={() => onViewChange(view)}
      className={`
        flex items-center gap-3 p-3 rounded-xl transition-all duration-300 w-full group
        ${currentView === view 
          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}
      `}
    >
      <Icon size={20} className={currentView === view ? 'animate-pulse' : ''} />
      <span className="font-medium text-sm">{label}</span>
      {currentView === view && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
      )}
    </button>
  );

  return (
    <div className="w-64 h-screen glass-panel flex flex-col p-6 fixed left-0 top-0 z-50">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
          <Hexagon className="text-white fill-white/20" size={24} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
            NexBuilder
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Orchestrator</p>
        </div>
      </div>

      <nav className="space-y-2 flex-1">
        <NavItem view="home" icon={Home} label="Project Hub" />
        <NavItem view="planner" icon={GitMerge} label="DAG Planner" />
        <NavItem view="builder" icon={Hammer} label="Build & Run" />
        <NavItem view="preview" icon={Eye} label="Live Preview" />
      </nav>

      <div className="pt-6 border-t border-slate-700/50">
        <NavItem view="settings" icon={Settings} label="Configuration" />
      </div>
    </div>
  );
};

export default Sidebar;