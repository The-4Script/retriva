import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { Activity, Search, Filter } from 'lucide-react';
import { AuditLog } from '../../services/adminService';

const AuditLogView = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    // Fetch last 100 logs
    const unsub = db.collection('auditLogs')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .onSnapshot(snap => {
         const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AuditLog[];
         setLogs(fetched);
         setLoading(false);
      });
    return () => unsub();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.actorEmail.toLowerCase().includes(search.toLowerCase()) || 
                          log.action.toLowerCase().includes(search.toLowerCase()) ||
                          log.targetId.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || log.targetType === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
       
       <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
         <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search actor, action, or ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
         </div>
         <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select 
              value={typeFilter}
              onChange={(e: any) => setTypeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 md:w-40"
            >
               <option value="ALL">All Types</option>
               <option value="USER">User</option>
               <option value="REPORT">Report</option>
               <option value="ADMIN">Admin</option>
               <option value="API_CONFIG">API Config</option>
               <option value="SYSTEM">System</option>
            </select>
         </div>
      </div>

       <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                     <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-48">Timestamp</th>
                     <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actor</th>
                     <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                     <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Target</th>
                     <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Reason</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLogs.map(log => (
                     <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="p-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                           {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 text-sm font-bold text-slate-800 dark:text-slate-200">
                           {log.actorEmail}
                        </td>
                        <td className="p-4">
                           <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-[10px] font-bold uppercase tracking-wider">
                              {log.action}
                           </span>
                        </td>
                        <td className="p-4">
                           <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-col">
                              <span className="font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-0.5">{log.targetType}</span>
                              <span className="font-mono">{log.targetId}</span>
                           </div>
                        </td>
                        <td className="p-4 text-sm text-slate-500">
                           {log.reason || <span className="opacity-30">-</span>}
                        </td>
                     </tr>
                  ))}
               </tbody>
             </table>
             {filteredLogs.length === 0 && (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
                   <Activity className="w-8 h-8 mb-3 text-slate-300 dark:text-slate-700" />
                   <p>No audit logs found.</p>
                </div>
             )}
          </div>
       </div>

    </div>
  );
};

export default AuditLogView;
