import React, { useEffect, useState } from 'react';
import { AppConfig, AIProvider } from '../types';
import { Save, Key, Cpu } from 'lucide-react';

interface SettingsModalProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (field: keyof AppConfig, value: string) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-1">
      <h2 className="text-3xl font-bold text-white mb-2">System Configuration</h2>
      <p className="text-slate-400 mb-8">Manage your Neural Interface connections.</p>

      <div className="glass-panel rounded-3xl p-8 space-y-8">
        
        {/* Provider Selection */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 block">AI Provider</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleChange('provider', 'google')}
              className={`p-4 rounded-2xl border transition-all text-left relative overflow-hidden ${
                localConfig.provider === 'google' 
                  ? 'border-blue-500 bg-blue-500/10 text-white' 
                  : 'border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600'
              }`}
            >
              <span className="font-bold block mb-1">Google Gemini</span>
              <span className="text-xs opacity-70">Native Integration (Fastest)</span>
              {localConfig.provider === 'google' && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/20 blur-xl rounded-full -mr-8 -mt-8 pointer-events-none" />
              )}
            </button>

            <button
              onClick={() => handleChange('provider', 'openrouter')}
              className={`p-4 rounded-2xl border transition-all text-left relative overflow-hidden ${
                localConfig.provider === 'openrouter' 
                  ? 'border-purple-500 bg-purple-500/10 text-white' 
                  : 'border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600'
              }`}
            >
              <span className="font-bold block mb-1">OpenRouter</span>
              <span className="text-xs opacity-70">Access Claude, Llama, Qwen</span>
              {localConfig.provider === 'openrouter' && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/20 blur-xl rounded-full -mr-8 -mt-8 pointer-events-none" />
              )}
            </button>
          </div>
        </div>

        {/* API Key */}
        {localConfig.provider === 'openrouter' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
              <Key size={14} /> OpenRouter API Key
            </label>
            <input
              type="password"
              value={localConfig.openRouterKey}
              onChange={(e) => handleChange('openRouterKey', e.target.value)}
              placeholder="sk-or-..."
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none transition-all font-mono"
            />
          </div>
        )}

        {/* Model Selection */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
            <Cpu size={14} /> Target Model
          </label>
          <input
            type="text"
            value={localConfig.model}
            onChange={(e) => handleChange('model', e.target.value)}
            placeholder={localConfig.provider === 'google' ? 'gemini-3-flash-preview' : 'anthropic/claude-3-5-sonnet'}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
          />
          <p className="text-xs text-slate-500 mt-2">
            Recommended: {localConfig.provider === 'google' ? 'gemini-3-flash-preview' : 'google/gemini-2.0-flash-001'}
          </p>
        </div>

        <div className="pt-6 border-t border-slate-700/50 flex justify-end">
          <button
            onClick={() => onSave(localConfig)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
          >
            <Save size={18} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
