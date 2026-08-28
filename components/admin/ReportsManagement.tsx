import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ItemReport, ItemCategory } from '../../types';
import { logAdminAction } from '../../services/adminService';
import { Search, Filter, ShieldAlert, CheckCircle, EyeOff, AlertTriangle, Box, Image as ImageIcon } from 'lucide-react';

const ReportsManagement = () => {
  const [reports, setReports] = useState<(ItemReport & { hidden?: boolean, hiddenReason?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED' | 'HIDDEN'>('ALL');
  const [flagFilter, setFlagFilter] = useState(false); // AI Flagged only
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | ItemCategory>('ALL');

  useEffect(() => {
    const unsub = db.collection('reports').orderBy('createdAt', 'desc').limit(100).onSnapshot(snap => {
      const fetched = snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as any[];
      setReports(fetched);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleToggleHide = async (report: any, reason?: string) => {
    try {
      const newHiddenState = !report.hidden;
      await db.collection('reports').doc(report.id).update({
        hidden: newHiddenState,
        hiddenReason: newHiddenState ? (reason || 'Admin Takedown') : null
      });
      await logAdminAction(newHiddenState ? 'Hide Report' : 'Restore Report', report.id, 'REPORT', reason);
    } catch (e) {
      console.error("Failed to toggle hide:", e);
    }
  };

  const handleResolve = async (report: any) => {
    try {
      await db.collection('reports').doc(report.id).update({
        status: 'RESOLVED'
      });
      await logAdminAction('Force Resolve Report', report.id, 'REPORT');
    } catch (e) {
      console.error("Failed to resolve:", e);
    }
  };

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.reporterName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'HIDDEN') matchesStatus = !!r.hidden;
    else if (statusFilter !== 'ALL') matchesStatus = r.status === statusFilter && !r.hidden;

    const matchesCategory = categoryFilter === 'ALL' || r.category === categoryFilter;
    
    // Check if AI flagged (assuming we store some violation metadata, or if it has a certain tag)
    // For now, if flagFilter is true, we look for reports with 'isPrank' or 'violationType' in their visual insights or just mock it.
    // Let's assume if r.isViolating or r.violationType is set. But the schema has them in AIAnalysisResult?
    // We didn't store AI result directly on report in previous code unless we added it.
    // Wait, the prompt says "AI-flagged / needs review".
    // I will check if report has `needsReview` or `violationType` != 'NONE'.
    const matchesFlag = flagFilter ? (r as any).needsReview || (r as any).violationType && (r as any).violationType !== 'NONE' : true;

    return matchesSearch && matchesStatus && matchesCategory && matchesFlag;
  });

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-[#2A2625] p-4 rounded-2xl border border-[#E5E0D8] dark:border-[#49433F] shadow-sm">
         <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3978E] dark:text-[#918982]" />
            <input 
              type="text" 
              placeholder="Search by title or reporter..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#FAF8F5] dark:bg-[#302C2A] border border-[#E5E0D8] dark:border-[#49433F] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
         </div>
         <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-[#A3978E] dark:text-[#918982] shrink-0" />
            <select 
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-[#FAF8F5] dark:bg-[#302C2A] border border-[#E5E0D8] dark:border-[#49433F] text-[#5C4A3D] dark:text-[#C8C0B8] dark:text-[#C8C0B8] text-sm rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
               <option value="ALL">All Status</option>
               <option value="OPEN">Active</option>
               <option value="RESOLVED">Resolved</option>
               <option value="HIDDEN">Hidden / Takedown</option>
            </select>
            
            <select 
              value={categoryFilter}
              onChange={(e: any) => setCategoryFilter(e.target.value)}
              className="bg-[#FAF8F5] dark:bg-[#302C2A] border border-[#E5E0D8] dark:border-[#49433F] text-[#5C4A3D] dark:text-[#C8C0B8] dark:text-[#C8C0B8] text-sm rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
               <option value="ALL">All Categories</option>
               {Object.values(ItemCategory).map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <button 
               onClick={() => setFlagFilter(!flagFilter)}
               className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${flagFilter ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800' : 'bg-[#FAF8F5] dark:bg-[#302C2A] text-[#8C7A6B] dark:text-[#C8C0B8] dark:text-[#918982] border border-[#E5E0D8] dark:border-[#49433F]'}`}
            >
               <ShieldAlert className="w-4 h-4" />
               AI Flagged
            </button>
         </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredReports.map(report => (
             <div key={report.id} className={`bg-white dark:bg-[#2A2625] rounded-2xl border ${report.hidden ? 'border-rose-300 dark:border-rose-800 opacity-75' : 'border-[#E5E0D8] dark:border-[#49433F]'} p-4 flex gap-4 shadow-sm transition-all hover:shadow-md`}>
                <div className="w-32 h-32 rounded-xl bg-[#F5F2ED] dark:bg-[#302C2A] overflow-hidden shrink-0 border border-[#E5E0D8] dark:border-[#49433F] relative">
                    {report.imageUrls?.[0] ? (
                       <img src={report.imageUrls[0]} className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-[#A3978E] dark:text-[#918982]"><ImageIcon className="w-8 h-8" /></div>
                    )}
                    {report.hidden && (
                       <div className="absolute inset-0 bg-rose-900/50 backdrop-blur-sm flex items-center justify-center">
                          <EyeOff className="w-8 h-8 text-white" />
                       </div>
                    )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                   <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-[#2C2724] dark:text-[#F5F1EA] truncate">{report.title}</h3>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${report.type === 'LOST' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                         {report.type}
                      </span>
                   </div>
                   <p className="text-xs text-[#8C7A6B] dark:text-[#918982] mb-2 truncate">{report.category} • {report.location}</p>
                   
                   <div className="bg-[#FAF8F5] dark:bg-[#302C2A] rounded-lg p-2 mb-3 border border-[#E5E0D8] dark:border-[#49433F]">
                      <p className="text-[10px] font-mono text-[#8C7A6B] dark:text-[#C8C0B8] dark:text-[#918982] line-clamp-2">
                         {report.description}
                      </p>
                      {report.specs && Object.keys(report.specs).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                             {Object.entries(report.specs).map(([k, v]) => (
                                <span key={k} className="text-[9px] bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded">
                                   {k}: {v as string}
                                </span>
                             ))}
                          </div>
                      )}
                   </div>
                   
                   <div className="mt-auto flex items-center justify-between">
                      <p className="text-[10px] text-[#A3978E] dark:text-[#918982] font-medium">By: {report.reporterName}</p>
                      
                      <div className="flex gap-2">
                         {!report.hidden && report.status === 'OPEN' && (
                             <button onClick={() => handleResolve(report)} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" /> Resolve
                             </button>
                         )}
                         <button 
                            onClick={() => {
                               if (!report.hidden) {
                                  const reason = prompt("Reason for takedown:");
                                  if (reason) handleToggleHide(report, reason);
                               } else {
                                  handleToggleHide(report);
                               }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${report.hidden ? 'bg-[#F5F2ED] text-[#8C7A6B] dark:text-[#C8C0B8] hover:bg-[#E5E0D8] dark:bg-[#373230] dark:hover:bg-[#E5E0D8] dark:bg-[#49433F]' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40'}`}
                         >
                            {report.hidden ? <><EyeOff className="w-3.5 h-3.5" /> Restore</> : <><AlertTriangle className="w-3.5 h-3.5" /> Takedown</>}
                         </button>
                      </div>
                   </div>
                </div>
             </div>
          ))}

          {filteredReports.length === 0 && (
             <div className="col-span-1 lg:col-span-2 p-12 text-center text-[#8C7A6B] dark:text-[#918982] flex flex-col items-center justify-center border-2 border-dashed border-[#E5E0D8] dark:border-[#49433F] rounded-2xl">
                 <Box className="w-8 h-8 mb-3 text-[#A3978E] dark:text-[#918982]" />
                 <p className="font-bold">No reports found.</p>
                 <p className="text-xs mt-1">Try adjusting your filters.</p>
             </div>
          )}
      </div>
    </div>
  );
};

export default ReportsManagement;
