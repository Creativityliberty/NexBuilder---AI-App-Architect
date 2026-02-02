import React, { useState, useEffect } from 'react';
import { Project, ProjectFile } from '../types';
import { Download, Monitor, Code, FileCode, RefreshCw } from 'lucide-react';

interface CodePreviewProps {
  project: Project;
}

const CodePreview: React.FC<CodePreviewProps> = ({ project }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [key, setKey] = useState(0); // Force iframe refresh

  // Set default selected file
  useEffect(() => {
    if (project.files.length > 0 && !selectedFile) {
      // Try to find index.html or App.tsx, otherwise first file
      const main = project.files.find(f => f.path.includes('index.html')) || project.files[0];
      setSelectedFile(main);
    }
  }, [project.files, selectedFile]);

  // Construct the preview blob
  useEffect(() => {
    if (project.files.length === 0) return;

    // Naive bundler for preview
    // We look for index.html and inject css/js if possible
    const indexHtml = project.files.find(f => f.path.endsWith('index.html'));
    
    if (indexHtml) {
      let content = indexHtml.content;
      
      // Inject CSS
      project.files.filter(f => f.path.endsWith('.css')).forEach(css => {
        // Simple heuristic replace or append
        if (content.includes(`<link rel="stylesheet" href="${css.path}">`)) {
           content = content.replace(`<link rel="stylesheet" href="${css.path}">`, `<style>${css.content}</style>`);
        } else {
           content = content.replace('</head>', `<style>${css.content}</style></head>`);
        }
      });

      // Inject JS
      project.files.filter(f => f.path.endsWith('.js')).forEach(js => {
         if (content.includes(`<script src="${js.path}"></script>`)) {
           content = content.replace(`<script src="${js.path}"></script>`, `<script>${js.content}</script>`);
         } else {
           content = content.replace('</body>', `<script>${js.content}</script></body>`);
         }
      });

      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      
      return () => URL.revokeObjectURL(url);
    } else {
      // No index.html, just show a message
      const blob = new Blob(['<html><body style="color:white; background:#0f172a; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh;"><h1>No index.html found</h1></body></html>'], { type: 'text/html' });
      setPreviewUrl(URL.createObjectURL(blob));
    }
  }, [project.files, key]);

  const handleExport = () => {
    if (!(window as any).JSZip || !(window as any).saveAs) {
      alert("Export libraries not loaded yet. Please wait.");
      return;
    }

    const zip = new (window as any).JSZip();
    project.files.forEach(file => {
      zip.file(file.path, file.content);
    });

    zip.generateAsync({type:"blob"}).then(function(content: Blob) {
        (window as any).saveAs(content, `${project.name.replace(/\s+/g, '_')}.zip`);
    });
  };

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Monitor className="text-cyan-400" /> Project Artifacts
        </h2>
        <div className="flex gap-3">
           <button 
            onClick={() => setKey(p => p + 1)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-lg shadow-lg transition-all text-sm font-bold"
          >
            <Download size={16} /> Export ZIP
          </button>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex border border-slate-700/50">
        {/* File Explorer */}
        <div className="w-64 bg-slate-900/50 border-r border-slate-700/50 flex flex-col">
          <div className="p-4 border-b border-slate-700/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
            Files ({project.files.length})
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {project.files.length === 0 && <div className="text-slate-500 text-xs p-4 italic">No files generated yet. Execute "Developer" tasks.</div>}
            {project.files.map(file => (
              <button
                key={file.path}
                onClick={() => { setSelectedFile(file); setActiveTab('code'); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${selectedFile?.path === file.path ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <FileCode size={14} />
                <span className="truncate">{file.path}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          {/* Tabs */}
          <div className="flex border-b border-slate-700 bg-slate-900/50">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'preview' ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <Monitor size={16} /> Live Preview
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'code' ? 'border-blue-400 text-blue-400 bg-blue-400/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <Code size={16} /> Source Code
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 relative overflow-hidden">
            {activeTab === 'preview' ? (
              <div className="w-full h-full bg-white">
                <iframe 
                  key={key}
                  src={previewUrl} 
                  className="w-full h-full border-none"
                  title="App Preview"
                  sandbox="allow-scripts allow-modals"
                />
              </div>
            ) : (
              <div className="w-full h-full overflow-auto custom-scrollbar">
                {selectedFile ? (
                   <pre className="p-6 text-sm font-mono text-slate-300 leading-relaxed">
                     <code>{selectedFile.content}</code>
                   </pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600">Select a file</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodePreview;