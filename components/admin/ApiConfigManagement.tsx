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
    { id: 'qwen3.8-27b', name: 'Qwen 3.8 27B (Vision)', maskedKey: 'via Vercel Env', status: 'UNKNOWN', dailyUsage: 0 },
    { id: 'gpt-oss-120b', name: 'GPT-OSS 120B (Primary)', maskedKey: 'via Vercel Env', status: 'UNKNOWN', dailyUsage: 0 },
    { id: 'gpt-oss-20b', name: 'GPT-OSS 20B (Fallback)', maskedKey: 'via Vercel Env', status: 'UNKNOWN', dailyUsage: 0 },
  ]);
  
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);

  useEffect(() => {
     const unsub = db.collection('aiIncidents').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
        const logs = snap.docs.map(doc => ({
           id: doc.id,
           timestamp: doc.data().timestamp,
           modelId: doc.data().mode || 'UNKNOWN',
           message: doc.data().message
        }));
        setErrorLogs(logs);
     });
     return () => unsub();
  }, []);

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
                   <p className="text-xs text-slate-500 italic">
                      Rotate keys via the Vercel dashboard → Environment Variables
                   </p>
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
