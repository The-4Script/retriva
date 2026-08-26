import React, { useState, useMemo, useEffect } from 'react';
import { ItemReport, ReportType, User, ViewState } from '../types';
import { Search, MapPin, SearchX, Box, Sparkles, ArrowRight, ScanLine, Loader2, RefreshCw, History, CheckCircle2, AlertCircle, Scan, Zap, Layers, Network, Wrench, ShieldCheck, Cpu, ChevronRight, Fingerprint, Radar, ChevronLeft, Target, User as UserIcon, WifiOff, HelpCircle, X, Check, Activity, Clock, Plus } from 'lucide-react';
import ReportDetails from './ReportDetails';
import { parseSearchQuery, findSmartMatches, getMatchTier } from '../services/aiService';

interface DashboardProps {
  user: User;
  reports: ItemReport[];
  onNavigate: (view: ViewState) => void;
  onResolve: (id: string) => void;
  onEditReport: (report: ItemReport) => void;
  onDeleteReport: (id: string) => void;
  onCompare: (item1: ItemReport, item2: ItemReport) => void;
  onChatStart: (report: ItemReport) => void;
}

interface ReportCardProps {
  report: ItemReport;
  onClick: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ report, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const isLost = report.type === ReportType.LOST;
  const isResolved = report.status === 'RESOLVED';

  return (
    <div 
      onClick={onClick}
      className={`group bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden hover:-translate-y-1 transition-all duration-500 cursor-pointer flex flex-col h-full relative 
        border border-slate-100 dark:border-slate-800
        shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-none
        ${isResolved ? 'opacity-75 grayscale-[0.5] hover:opacity-100 hover:grayscale-0' : 
          (isLost ? 'hover:border-orange-500/30 hover:shadow-orange-500/10' : 'hover:border-teal-500/30 hover:shadow-teal-500/10')
        }
      `}
    >
       <div className="absolute top-4 left-4 z-10 flex gap-2">
          <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-lg text-white backdrop-blur-md border border-white/10 ${isLost ? 'bg-orange-500/90' : 'bg-teal-500/90'}`}>
            {isLost ? 'Lost' : 'Found'}
          </span>
          {isResolved && (
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-lg text-white backdrop-blur-md bg-emerald-500/90 border border-white/10 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Resolved
            </span>
          )}
       </div>

      <div className="h-56 bg-slate-50 dark:bg-slate-800 relative overflow-hidden">
          {!imgError && report.imageUrls[0] ? (
            <img src={report.imageUrls[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" onError={() => setImgError(true)} alt={report.title} loading="lazy" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/50">
              <Box className="w-12 h-12 mb-3 opacity-20" />
            </div>
          )}
          
          {/* Subtle gradient overlay for text readability if needed in future, mainly for depth here */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-3">
          <div className="flex justify-between items-start">
             <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                {report.category}
             </span>
             <span className="text-[10px] font-semibold text-slate-400">{report.date}</span>
          </div>

          <h3 className={`font-black text-lg text-slate-800 dark:text-white leading-tight line-clamp-2 ${
              isResolved ? 'text-slate-500' : (isLost ? 'group-hover:text-orange-600 dark:group-hover:text-orange-400' : 'group-hover:text-teal-600 dark:group-hover:text-teal-400')
          } transition-colors`}>
              {report.title}
          </h3>
          
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-auto pt-2">
             <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
             <span className="truncate">{report.location}</span>
          </div>
      </div>

      <div className="px-5 pb-5 pt-0 mt-auto">
         <button className={`w-full py-3.5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-transparent
            ${isResolved 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700' 
                : (isLost 
                    ? 'bg-orange-50 dark:bg-slate-800 text-orange-600 dark:text-orange-400 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-900/30 border-orange-100 dark:border-orange-900/30 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/20' 
                    : 'bg-teal-50 dark:bg-slate-800 text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white dark:hover:bg-teal-900/30 border-teal-100 dark:border-teal-900/30 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/20')
            }
         `}>
            {isResolved ? 'View History' : 'View Details'} <ArrowRight className="w-3.5 h-3.5" />
         </button>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user, reports, onNavigate, onResolve, onEditReport, onDeleteReport, onCompare, onChatStart }) => {
  const [activeTab, setActiveTab] = useState<ReportType>(ReportType.LOST);
  const [viewStatus, setViewStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [showMyReports, setShowMyReports] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessingSearch, setIsProcessingSearch] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ItemReport | null>(null);

  const filteredReports = useMemo(() => {
    let result = reports.filter(r => r.type === activeTab && r.status === viewStatus);
    
    if (showMyReports) {
        result = result.filter(r => r.reporterId === user.id);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.title.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [reports, activeTab, viewStatus, searchQuery, showMyReports, user.id]);

  const handleSmartSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsProcessingSearch(true);
    try {
      const { userStatus, refinedQuery } = await parseSearchQuery(searchQuery);
      if (userStatus === 'LOST') setActiveTab(ReportType.FOUND);
      else if (userStatus === 'FOUND') setActiveTab(ReportType.LOST);
      setSearchQuery(refinedQuery);
    } finally {
      setIsProcessingSearch(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {selectedReport && (
        <ReportDetails 
          report={selectedReport} allReports={reports} currentUser={user} 
          onClose={() => setSelectedReport(null)}
          onResolve={(id) => { onResolve(id); setSelectedReport(null); }}
          onEdit={(r) => { onEditReport(r); setSelectedReport(null); }}
          onDelete={(id) => { onDeleteReport(id); setSelectedReport(null); }}
          onNavigateToChat={(report) => { onChatStart(report); setSelectedReport(null); }}
          onViewMatch={(r) => setSelectedReport(r)} 
          onCompare={(item1, item2) => {
             onCompare(item1, item2);
          }}
        />
      )}

      {/* Hero Section */}
      <section className="relative w-full">
          <div className="relative rounded-[2.5rem] bg-gradient-to-br from-[#1e1b4b] via-[#0f172a] to-[#020617] overflow-hidden p-8 md:p-12 flex flex-col lg:flex-row items-center justify-between gap-10 shadow-2xl border border-white/5">
             
             {/* Background Decor */}
             <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                 <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
                 <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
             </div>

             {/* Left Side */}
             <div className="relative z-10 w-full max-w-xl space-y-7 text-center lg:text-left">
                 {/* Badge */}
                 <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-indigo-300 backdrop-blur-md mx-auto lg:mx-0 shadow-lg">
                     <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                     <span>Cognal Intelligence</span>
                 </div>
                 
                 {/* Title */}
                 <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-[0.9]">
                    From Lost <br/>
                    to Retrieved
                 </h1>

                 {/* Subtitle */}
                 <p className="text-lg text-slate-300 font-medium leading-relaxed max-w-md mx-auto lg:mx-0">
                     Reconnect with what you’ve lost using visual AI.
                 </p>

             </div>

             {/* Right Side - Buttons */}
             <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">
                 <button 
                   onClick={() => onNavigate('REPORT_LOST')}
                   className="w-full flex items-center gap-5 p-5 bg-[#171925]/90 hover:bg-[#1f2233] border border-white/5 rounded-[2rem] group transition-all duration-300 shadow-xl hover:shadow-[0_0_40px_rgba(249,115,22,0.3)] hover:border-orange-500/50 hover:-translate-y-1 backdrop-blur-md"
                 >
                     <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/30">
                         <Search className="w-6 h-6 text-white" />
                     </div>
                     <div className="text-left">
                         <h3 className="text-white font-bold text-xl leading-tight">I Lost Something</h3>
                         <p className="text-slate-400 text-xs font-medium mt-0.5">Report a lost item</p>
                     </div>
                     <ArrowRight className="ml-auto w-5 h-5 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                 </button>

                 <button 
                   onClick={() => onNavigate('REPORT_FOUND')}
                   className="w-full flex items-center gap-5 p-5 bg-[#171925]/90 hover:bg-[#1f2233] border border-white/5 rounded-[2rem] group transition-all duration-300 shadow-xl hover:shadow-[0_0_40px_rgba(20,184,166,0.3)] hover:border-teal-500/50 hover:-translate-y-1 backdrop-blur-md"
                 >
                     <div className="w-12 h-12 bg-teal-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/30">
                         <Box className="w-6 h-6 text-white" />
                     </div>
                     <div className="text-left">
                         <h3 className="text-white font-bold text-xl leading-tight">I Found Something</h3>
                         <p className="text-slate-400 text-xs font-medium mt-0.5">Report a found item</p>
                     </div>
                     <ArrowRight className="ml-auto w-5 h-5 text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                 </button>
             </div>
          </div>
      </section>

      {/* AI DISCOVERY HUB - Always Visible with Empty State logic */}

      {/* Main Content Feed */}
      <section className="space-y-8">
         {/* ACTION BAR: Redesigned for better light mode visibility */}
         <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3 md:p-4 rounded-[2rem] border border-white/20 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none flex flex-col md:flex-row items-center gap-4 sticky top-24 z-30 transition-all duration-300">
            
            <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Segmented Control */}
                <div className="flex p-1.5 bg-slate-100/80 dark:bg-slate-800 rounded-2xl shrink-0 shadow-inner">
                   <button onClick={() => setActiveTab(ReportType.LOST)} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === ReportType.LOST ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-lg shadow-slate-200/50 dark:shadow-none scale-105' : 'text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Lost</button>
                   <button onClick={() => setActiveTab(ReportType.FOUND)} className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === ReportType.FOUND ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-lg shadow-slate-200/50 dark:shadow-none scale-105' : 'text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Found</button>
                </div>
                
                {/* Toggles */}
                <button 
                  onClick={() => setShowMyReports(!showMyReports)}
                  className={`p-3 rounded-2xl border transition-all duration-300 ${showMyReports 
                    ? 'bg-indigo-50 dark:bg-slate-800 border-indigo-200 dark:border-slate-700 text-indigo-600 shadow-md shadow-indigo-500/10' 
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600 hover:bg-slate-50 shadow-sm'
                  }`}
                  title={showMyReports ? "Show All Reports" : "Show My Reports Only"}
                >
                   <UserIcon className="w-5 h-5" />
                </button>

                <button 
                  onClick={() => setViewStatus(prev => prev === 'OPEN' ? 'RESOLVED' : 'OPEN')}
                  className={`p-3 rounded-2xl border transition-all duration-300 ${viewStatus === 'RESOLVED' 
                    ? 'bg-purple-50 dark:bg-slate-800 border-purple-200 dark:border-slate-700 text-purple-600 shadow-md shadow-purple-500/10' 
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600 hover:bg-slate-50 shadow-sm'
                  }`}
                  title={viewStatus === 'OPEN' ? "Show Resolved History" : "Show Active Reports"}
                >
                   <History className="w-5 h-5" />
                </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 w-full group">
               <div className={`absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur-md transition-opacity duration-300 -z-10 ${searchQuery ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}></div>
               <div className="relative">
                   <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${searchQuery ? 'text-indigo-500' : 'text-slate-400'}`} />
                   <input 
                     type="text" 
                     value={searchQuery} 
                     onChange={(e) => setSearchQuery(e.target.value)} 
                     onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()} 
                     placeholder="Describe what you are looking for..." 
                     className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/20 transition-all shadow-inner placeholder:text-slate-400 text-slate-700 dark:text-slate-200" 
                    />
                   {isProcessingSearch && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-violet" />}
               </div>
            </div>
         </div>

         <div className="flex items-center gap-3 px-4">
            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">
              {showMyReports ? 'My ' : ''}{viewStatus === 'RESOLVED' ? 'Resolved Archive' : 'Active Listings'}
            </h3>
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
               {filteredReports.length} Items
            </span>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 px-2">
            {filteredReports.map(report => <ReportCard key={report.id} report={report} onClick={() => setSelectedReport(report)} />)}
            {filteredReports.length === 0 && (
               <div className="col-span-full py-24 text-center flex flex-col items-center justify-center text-slate-400">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm">
                     {viewStatus === 'RESOLVED' ? <History className="w-8 h-8 opacity-40" /> : <SearchX className="w-8 h-8 opacity-40" />}
                  </div>
                  <p className="font-bold text-lg text-slate-600 dark:text-slate-300">No {showMyReports ? 'personal' : ''} {viewStatus === 'RESOLVED' ? 'resolved' : 'active'} items found.</p>
                  <p className="text-sm mt-2 max-w-xs mx-auto">Try adjusting your search filters or check back later.</p>
               </div>
            )}
         </div>
      </section>
    </div>
  );
};

export default Dashboard;