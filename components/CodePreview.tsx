import React, { useState, useEffect } from 'react';
import { Project, ProjectFile } from '../types';
import { Download, Monitor, Code, FileCode, RefreshCw, AlertTriangle, Wrench, X } from 'lucide-react';
import Editor from "@monaco-editor/react";

interface CodePreviewProps {
  project: Project;
  onFixError?: (errorMsg: string, stack: string) => void;
  onUpdateFile?: (path: string, newContent: string) => void;
}

const CodePreview: React.FC<CodePreviewProps> = ({ project, onFixError, onUpdateFile }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [key, setKey] = useState(0); // Force iframe refresh
  const [runtimeError, setRuntimeError] = useState<{message: string, stack: string} | null>(null);

  // Set default selected file
  useEffect(() => {
    if (project.files.length > 0 && !selectedFile) {
      // Try to find index.html or App.tsx, otherwise first file
      const main = project.files.find(f => f.path.includes('index.html')) || project.files[0];
      setSelectedFile(main);
    }
  }, [project.files, selectedFile]);

  // Sync selected file content when project updates (if external update happened)
  useEffect(() => {
    if (selectedFile) {
        const latest = project.files.find(f => f.path === selectedFile.path);
        if (latest && latest !== selectedFile) {
            setSelectedFile(latest);
        }
    }
  }, [project.files, selectedFile]);

  // Construct the preview blob - Only when in Preview mode or explicitly refreshed
  useEffect(() => {
    if (activeTab !== 'preview') return;
    
    setRuntimeError(null); // Clear errors on refresh
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

      // ---------------------------------------------------------
      // FEATURE: SELF-HEALING ERROR INJECTION
      // ---------------------------------------------------------
      const errorTrapScript = `
        <script>
          window.onerror = function(message, source, lineno, colno, error) {
            window.parent.postMessage({
              type: 'NEXBUILDER_RUNTIME_ERROR',
              payload: {
                message: message,
                stack: error ? error.stack : 'No stack trace available. Check line ' + lineno
              }
            }, '*');
          };
          window.addEventListener('unhandledrejection', function(event) {
            window.parent.postMessage({
              type: 'NEXBUILDER_RUNTIME_ERROR',
              payload: {
                message: 'Unhandled Promise Rejection: ' + event.reason,
                stack: ''
              }
            }, '*');
          });
        </script>
      `;
      // Inject at the very top of head to catch everything
      if (content.includes('<head>')) {
        content = content.replace('<head>', `<head>${errorTrapScript}`);
      } else {
        content = `${errorTrapScript}${content}`;
      }
      // ---------------------------------------------------------

      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      
      return () => URL.revokeObjectURL(url);
    } else {
      // No index.html, just show a message
      const blob = new Blob(['<html><body style="color:white; background:#0f172a; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh;"><h1>No index.html found</h1></body></html>'], { type: 'text/html' });
      setPreviewUrl(URL.createObjectURL(blob));
    }
  }, [project.files, key, activeTab]);

  // Listen for errors from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NEXBUILDER_RUNTIME_ERROR') {
        console.warn("Captured App Error:", event.data.payload);
        setRuntimeError(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && selectedFile && onUpdateFile) {
        onUpdateFile(selectedFile.path, value);
    }
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
            <RefreshCw size={16} /> Refresh Preview
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
              <Code size={16} /> Editor
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
            {activeTab === 'preview' ? (
              <>
                <div className="w-full h-full relative bg-white">
                  <iframe 
                    key={key}
                    src={previewUrl} 
                    className="w-full h-full border-none"
                    title="App Preview"
                    sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
                  />
                  
                  {/* Runtime Error Overlay */}
                  {runtimeError && (
                    <div className="absolute bottom-4 left-4 right-4 bg-red-950/95 border border-red-500/50 text-white p-4 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 z-50">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                           <div className="bg-red-500/20 p-2 rounded-lg h-fit">
                              <AlertTriangle className="text-red-400" size={24} />
                           </div>
                           <div>
                              <h3 className="font-bold text-red-200">Runtime Error Detected</h3>
                              <p className="font-mono text-sm text-red-300 mt-1 mb-2">{runtimeError.message}</p>
                              {runtimeError.stack && (
                                <details className="text-xs text-red-400/70 font-mono cursor-pointer mb-3">
                                  <summary>View Stack Trace</summary>
                                  <pre className="mt-2 p-2 bg-black/30 rounded overflow-x-auto">
                                    {runtimeError.stack}
                                  </pre>
                                </details>
                              )}
                              
                              {onFixError && (
                                <button 
                                  onClick={() => onFixError(runtimeError.message, runtimeError.stack)}
                                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-red-900/50"
                                >
                                  <Wrench size={16} /> Auto-Fix with AI
                                </button>
                              )}
                           </div>
                        </div>
                        <button 
                          onClick={() => setRuntimeError(null)}
                          className="text-red-400 hover:text-white"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full h-full">
                {selectedFile ? (
                   <Editor
                      height="100%"
                      defaultLanguage={selectedFile.language === 'js' ? 'javascript' : selectedFile.language}
                      language={selectedFile.language === 'js' ? 'javascript' : selectedFile.language}
                      theme="vs-dark"
                      value={selectedFile.content}
                      onChange={handleEditorChange}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        padding: { top: 20 },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        fontFamily: "'JetBrains Mono', monospace"
                      }}
                    />
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