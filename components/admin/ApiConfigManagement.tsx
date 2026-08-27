import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { logAdminAction } from '../../services/adminService';
import { Key, Activity, ServerCrash, Save, CheckCircle, XCircle } from 'lucide-react';

interface ModelConfig {
  id: string;
  name: string;
  maskedKey: string;
  status: 'ONLINE' | 'RATE_LIMITED' | 'UNKNOWN';
  dailyUsage: number;
}

interface ErrorLog {
  id: string;
  timestamp: number;
  modelId: string;
  message: string;
}

const ApiConfigManagement = () => {
  const [models, setModels] = useState<ModelConfig[]>([
    { id: 'qwen3.6-27b', name: 'Qwen 3.6 27B (Vision)', maskedKey: 'gsk_****xyz3', status: 'ONLINE', dailyUsage: 142 },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Primary)', maskedKey: 'gsk_****abc1', status: 'ONLINE', dailyUsage: 856 },
    { id: 'gpt-oss-20b', name: 'GPT-OSS 20B (Fallback)', maskedKey: 'gsk_****def2', status: 'UNKNOWN', dailyUsage: 0 },
  ]);
  
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([
    { id: '1', timestamp: Date.now() - 3600000, modelId: 'gpt-oss-120b', message: 'Rate limit exceeded: 429 Too Many Requests' },
    { id: '2', timestamp: Date.now() - 7200000, modelId: 'qwen3.6-27b', message: 'Failed to parse JSON response' }
  ]);

  const [editKeys, setEditKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // In a real app, you would fetch these from a secure backend or Firestore.
  // We'll mock the fetch here since keys shouldn't be in plaintext on the client.
  
  const handleUpdateKey = async (modelId: string) => {
    const newKey = editKeys[modelId];
    if (!newKey) return;
    
    setSaving(modelId);
    try {
      /* 
         CRITICAL SECURITY NOTE:
         This should go through Vercel's environment variable API or a secrets manager.
         Never store the raw API key in Firestore in plaintext.
         For this prototype, we'll log the action and mock the update.
         In production, hit a protected serverless function:
         await fetch('/api/admin/update-key', { method: 'POST', body: JSON.stringify({ modelId, key: newKey }) })
      */
      
      await new Promise(r => setTimeout(r, 1000)); // Simulate API call
      
      // Update UI with masked key
      const masked = newKey.length > 8 ? `${newKey.substring(0, 4)}****${newKey.substring(newKey.length - 4)}` : '****';
      setModels(prev => prev.map(m => m.id === modelId ? { ...m, maskedKey: masked } : m));
      
      await logAdminAction('Update AI API Key', modelId, 'API_CONFIG');
      
      setEditKeys(prev => ({ ...prev, [modelId]: '' }));
    } catch (e) {
      console.error("Failed to update key", e);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.map(model => (
             <div key={model.id} className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <h3 className="font-bold text-slate-800 dark:text-white text-lg">{model.name}</h3>
                      <p className="text-xs font-mono text-slate-500 mt-1">{model.id}</p>
                   </div>
                   <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                        ${model.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-700' : 
                          model.status === 'RATE_LIMITED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}
                   `}>
                      {model.status === 'ONLINE' ? <CheckCircle className="w-3 h-3" /> : model.status === 'RATE_LIMITED' ? <XCircle className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                      {model.status}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Daily Usage</p>
                      <p className="text-xl font-black text-slate-700 dark:text-slate-200">{model.dailyUsage}</p>
                   </div>
                   <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Current Key</p>
                      <p className="text-sm font-mono text-slate-700 dark:text-slate-200 truncate">{model.maskedKey}</p>
                   </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                   <label className="text-xs font-bold text-slate-500 mb-2 block">Update API Key</label>
                   <div className="flex gap-2">
                      <div className="relative flex-1">
                         <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                         <input 
                           type="password" 
                           placeholder="Paste new key..."
                           value={editKeys[model.id] || ''}
                           onChange={e => setEditKeys({...editKeys, [model.id]: e.target.value})}
                           className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                         />
                      </div>
                      <button 
                        onClick={() => handleUpdateKey(model.id)}
                        disabled={!editKeys[model.id] || saving === model.id}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                      >
                         {saving === model.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-4 h-4" />}
                      </button>
                   </div>
                </div>
             </div>
          ))}
       </div>

       {/* ERROR LOG */}
       <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-3">
             <ServerCrash className="w-5 h-5 text-rose-500" />
             <h3 className="font-bold text-slate-800 dark:text-white">Recent AI Errors (Last 20)</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
             {errorLogs.map(log => (
                <div key={log.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                   <div className="text-xs text-slate-400 font-mono w-32 shrink-0">
                      {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                   </div>
                   <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 w-fit shrink-0">
                      {log.modelId}
                   </div>
                   <div className="text-sm text-rose-600 dark:text-rose-400 font-mono break-all">
                      {log.message}
                   </div>
                </div>
             ))}
             {errorLogs.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">No recent AI errors recorded.</div>
             )}
          </div>
       </div>

    </div>
  );
};

export default ApiConfigManagement;
