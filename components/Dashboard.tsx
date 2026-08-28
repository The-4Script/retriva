import React, { useState, useMemo, useEffect } from 'react';
import { ItemReport, ReportType, User, ViewState } from '../types';
import { Search, MapPin, SearchX, Box, Sparkles, ArrowRight, ScanLine, Loader2, RefreshCw, History, CheckCircle2, AlertCircle, Scan, Zap, Layers, Network, Wrench, ShieldCheck, Cpu, ChevronRight, Fingerprint, Radar, ChevronLeft, Target, User as UserIcon, WifiOff, HelpCircle, X, Check, Activity, Clock, Plus, Filter } from 'lucide-react';
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
      className={`group bg-white dark:bg-[#302C2A] rounded-3xl overflow-hidden hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full relative
        border border-[#E5E0D8] dark:border-[#49433F] shadow-sm hover:shadow-md dark:hover:bg-[#373230]
        ${isResolved ? 'opacity-75 grayscale-[0.5] hover:opacity-100 hover:grayscale-0' : ''}
      `}
    >
       <div className="absolute top-4 left-4 z-10 flex gap-2">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white ${isLost ? 'bg-[#F97316]' : 'bg-[#0F766E]'}`}>
            {isLost ? 'Lost' : 'Found'}
          </span>
          {isResolved && (
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white bg-[#16A34A] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Resolved
            </span>
          )}
       </div>

      <div className="h-56 bg-[#FAF8F5] dark:bg-[#2A2625] relative overflow-hidden border-b border-[#E5E0D8] dark:border-[#49433F] transition-colors">
          {!imgError && report.imageUrls[0] ? (
            <img src={report.imageUrls[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={() => setImgError(true)} alt={report.title} loading="lazy" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#B08D73] dark:text-[#C8C0B8]">
              <Box className="w-12 h-12 mb-3 opacity-20" />
            </div>
          )}
      </div>

      <div className="p-5 flex-1 flex flex-col gap-2">
          <span className="text-[9px] font-bold text-[#B08D73] dark:text-[#C8C0B8] uppercase tracking-widest mt-1">
             {report.category}
          </span>

          <h3 className={`font-bold text-lg leading-tight line-clamp-2 transition-colors ${
              isResolved ? 'text-[#8C7A6B] dark:text-[#918982]' : 'text-[#2C2724] dark:text-[#F5F1EA] group-hover:text-[#F97316]'
          }`}>
              {report.title}
          </h3>
          
          <div className="flex items-center justify-between mt-auto pt-4">
             <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8C7A6B] dark:text-[#C8C0B8]">
                <MapPin className="w-3.5 h-3.5 text-[#B08D73] dark:text-[#C8C0B8]" />
                <span className="truncate max-w-[100px]">{report.location}</span>
             </div>
             <span className="text-[10px] font-medium text-[#8C7A6B] dark:text-[#918982]">{report.date}</span>
          </div>
      </div>

      {/* Very minimal View Details button to satisfy requirement while staying clean */}
      <div className="px-5 pb-5 pt-0">
         <div className={`w-full py-2.5 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-2
            ${isResolved 
                ? 'bg-[#F5F2ED] text-[#8C7A6B] dark:bg-[#373230] dark:text-[#918982]'
                : (isLost 
                    ? 'bg-[#FFF4ED] text-[#EA580C] dark:bg-[#F97316]/10 dark:text-[#F97316] group-hover:bg-[#F97316] group-hover:text-white'
                    : 'bg-[#F0FDFA] text-[#0D9488] dark:bg-[#14B8A6]/10 dark:text-[#14B8A6] group-hover:bg-[#0F766E] group-hover:text-white')
            }
         `}>
            {isResolved ? 'View History' : 'View Details'} <ArrowRight className="w-3.5 h-3.5" />
         </div>
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
    <div className="w-full space-y-8 pb-20">
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
      <section className="relative w-full mb-8">
          <div className="relative py-4 md:py-6 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
             
             {/* Left Side */}
             <div className="relative z-10 w-full lg:w-[45%] xl:w-[40%] space-y-5 text-center lg:text-left">
                 {/* Badge */}
                 <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E4D5C7] dark:bg-[#373230] text-[10px] font-bold uppercase tracking-widest text-[#5C4A3D] dark:text-[#C8C0B8] mx-auto lg:mx-0">
                     <span>VISUAL AI POWERED</span>
                 </div>
                 
                 {/* Title */}
                 <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1] text-[#33261D] dark:text-[#F5F1EA]">
                    Lost something <br/>
                    on campus?
                 </h1>

                 {/* Subtitle & Description */}
                 <div className="space-y-2">
                     <p className="text-xl text-[#33261D] dark:text-[#F5F1EA] font-bold">
                         Let RETRIVA trace it back to you.
                     </p>
                     <p className="text-base text-[#8C7A6B] dark:text-[#C8C0B8] font-medium leading-relaxed max-w-md mx-auto lg:mx-0">
                         AI-powered visual matching helps reconnect lost and found items across campus.
                     </p>
                 </div>

                 {/* Buttons */}
                 <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
                     <button
                       onClick={() => onNavigate('REPORT_LOST')}
                       className="flex items-center justify-center gap-2 px-8 py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/20"
                     >
                         <span>Report Lost Item</span>
                         <ArrowRight className="w-4 h-4" />
                     </button>

                     <button
                       onClick={() => onNavigate('REPORT_FOUND')}
                       className="flex items-center justify-center gap-2 px-8 py-4 bg-[#0F766E] hover:bg-[#0D625C] text-white rounded-2xl font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-700/20"
                     >
                         <span>Report Found Item</span>
                         <ArrowRight className="w-4 h-4" />
                     </button>
                 </div>
             </div>

             {/* Right Side - Trace Illustration */}
             <div className="relative z-10 w-full lg:w-[55%] xl:w-[60%] hidden md:flex items-center justify-end">
                 {/* Light mode image */}
                 <img src="/hero.jpeg" alt="Retriva Trace Illustration" className="dark:hidden w-full h-auto max-h-[500px] xl:max-h-[650px] object-contain object-right" />
                 {/* Dark mode image */}
                 <img src="/hero2.jpeg" alt="Retriva Trace Illustration - Dark Mode" className="hidden dark:block w-full h-auto max-h-[500px] xl:max-h-[650px] object-contain object-right" />
             </div>
          </div>
      </section>

      {/* AI DISCOVERY HUB - Always Visible with Empty State logic */}


      {/* Main Content Feed - Wrapped in large white container */}
      <section className="bg-white dark:bg-[#302C2A] w-full rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-[#E5E0D8] dark:border-[#49433F] space-y-10 transition-colors">

         <div className="space-y-4">
            <h2 className="text-2xl font-bold text-[#33261D] dark:text-[#F5F1EA]">Find what you're looking for</h2>

            {/* ACTION BAR: Redesigned for Warm Neutral minimal look */}
            <div className="flex flex-col md:flex-row items-center gap-4">

               <div className="flex items-center gap-2 w-full md:w-auto">
                   {/* Segmented Control */}
                   <div className="flex p-1 bg-[#F5F2ED] dark:bg-[#2A2625] rounded-xl shrink-0 transition-colors">
                      <button onClick={() => { setActiveTab(ReportType.LOST); setViewStatus('OPEN'); }} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === ReportType.LOST && viewStatus === 'OPEN' ? 'bg-[#F97316] text-white shadow-sm' : 'text-[#8C7A6B] dark:text-[#918982] hover:text-[#2C2724] dark:hover:text-[#F5F1EA]'}`}>Lost Items</button>
                      <button onClick={() => { setActiveTab(ReportType.FOUND); setViewStatus('OPEN'); }} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${activeTab === ReportType.FOUND && viewStatus === 'OPEN' ? 'bg-white dark:bg-[#373230] text-[#2C2724] dark:text-[#F5F1EA] shadow-sm' : 'text-[#8C7A6B] dark:text-[#918982] hover:text-[#2C2724] dark:hover:text-[#F5F1EA]'}`}>Found Items</button>
                      <button onClick={() => setViewStatus('RESOLVED')} className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${viewStatus === 'RESOLVED' ? 'bg-[#16A34A] text-white shadow-sm' : 'text-[#8C7A6B] dark:text-[#918982] hover:text-[#2C2724] dark:hover:text-[#F5F1EA]'}`}>Resolved Items</button>
                   </div>

                   {/* Minimal Filter Button */}
                   <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#2A2625] border border-[#E5E0D8] dark:border-[#49433F] text-[#2C2724] dark:text-[#F5F1EA] hover:bg-[#F5F2ED] dark:hover:bg-[#373230] transition-colors ml-auto md:ml-0 font-semibold text-sm">
                      <Filter className="w-4 h-4" />
                      <span>Filters</span>
                   </button>
               </div>

               {/* Search Input */}
               <div className="relative flex-1 w-full">
                   <div className="relative">
                       <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${searchQuery ? 'text-[#2C2724] dark:text-[#F5F1EA]' : 'text-[#A3978E] dark:text-[#918982]'}`} />
                       <input
                         type="text"
                         value={searchQuery}
                         onChange={(e) => setSearchQuery(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
                         placeholder="Search by item name, category, location..."
                         className="w-full pl-12 pr-4 py-3 bg-[#FAF8F5] dark:bg-[#2A2625] border border-[#E5E0D8] dark:border-[#49433F] rounded-xl text-sm font-medium outline-none focus:border-[#B08D73] dark:focus:border-teal-600 focus:bg-white dark:focus:bg-[#302C2A] transition-colors placeholder:text-[#A3978E] dark:placeholder:text-[#918982] text-[#2C2724] dark:text-[#F5F1EA]"
                        />
                       {isProcessingSearch && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#B08D73] dark:text-[#C8C0B8]" />}
                   </div>
               </div>
            </div>
         </div>

         <div className="flex items-center justify-between pt-6 border-t border-[#F0ECE4] dark:border-[#49433F] transition-colors">
            <h3 className="text-xl font-bold text-[#33261D] dark:text-[#F5F1EA]">
              {showMyReports ? 'My ' : ''}{viewStatus === 'RESOLVED' ? 'Resolved Archive' : 'Recent Campus Listings'}
            </h3>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {filteredReports.map(report => <ReportCard key={report.id} report={report} onClick={() => setSelectedReport(report)} />)}
            {filteredReports.length === 0 && (
               <div className="col-span-full py-24 text-center flex flex-col items-center justify-center text-[#A3978E] dark:text-[#918982]">
                  <div className="w-20 h-20 bg-[#F5F2ED] dark:bg-[#373230] rounded-full flex items-center justify-center mb-6">
                     {viewStatus === 'RESOLVED' ? <History className="w-8 h-8 opacity-40 text-[#5C4A3D] dark:text-[#F5F1EA]" /> : <SearchX className="w-8 h-8 opacity-40 text-[#5C4A3D] dark:text-[#F5F1EA]" />}
                  </div>
                  <p className="font-bold text-lg text-[#5C4A3D] dark:text-[#F5F1EA]">No {showMyReports ? 'personal' : ''} {viewStatus === 'RESOLVED' ? 'resolved' : 'active'} items found.</p>
                  <p className="text-sm mt-2 max-w-xs mx-auto text-[#8C7A6B] dark:text-[#C8C0B8]">Try adjusting your search filters or check back later.</p>
               </div>
            )}
         </div>
      </section>
    </div>
  );
};

export default Dashboard;
