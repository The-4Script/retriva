import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Activity, FileText, CheckCircle, Clock } from 'lucide-react';

const AnalyticsView = () => {
  const [stats, setStats] = useState<any>({
    reportsByDay: [],
    reportsByCategory: [],
    avgResolveTime: 'N/A',
    totalResolved: 0,
    totalReports: 0
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Basic analytics logic
    const fetchAnalytics = async () => {
       try {
           const reportsSnap = await db.collection('reports').get();
           const reports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as any[];
           
           // Category Data
           const catCount: Record<string, number> = {};
           reports.forEach(r => {
              catCount[r.category] = (catCount[r.category] || 0) + 1;
           });
           const reportsByCategory = Object.entries(catCount).map(([name, value]) => ({ name, value }));

           // By Day (Last 7 days)
           const days: Record<string, number> = {};
           for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              days[d.toLocaleDateString(undefined, { weekday: 'short' })] = 0;
           }
           reports.forEach(r => {
              if (r.createdAt > Date.now() - 7 * 24 * 60 * 60 * 1000) {
                 const day = new Date(r.createdAt).toLocaleDateString(undefined, { weekday: 'short' });
                 if (days[day] !== undefined) days[day]++;
              }
           });
           const reportsByDay = Object.entries(days).map(([name, count]) => ({ name, count }));

           const resolved = reports.filter(r => r.status === 'RESOLVED');
           
           let totalResolveTime = 0;
           let resolvedWithTime = 0;
           resolved.forEach(r => {
              if (r.resolvedAt && r.createdAt) {
                  totalResolveTime += (r.resolvedAt - r.createdAt);
                  resolvedWithTime++;
              }
           });
           
           let avgResolveTimeStr = 'N/A';
           if (resolvedWithTime > 0) {
               const avgMs = totalResolveTime / resolvedWithTime;
               const days = (avgMs / (1000 * 60 * 60 * 24)).toFixed(1);
               avgResolveTimeStr = `${days} Days`;
           }

           setStats({
              reportsByDay,
              reportsByCategory,
              avgResolveTime: avgResolveTimeStr,
              totalResolved: resolved.length,
              totalReports: reports.length
           });
       } catch (e) {
           console.error("Failed to load analytics", e);
       } finally {
           setLoading(false);
       }
    };
    fetchAnalytics();
  }, []);

  const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
       
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#2A2625] p-5 rounded-2xl border border-[#E5E0D8] dark:border-[#49433F] shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <FileText className="w-6 h-6" />
             </div>
             <div>
                <p className="text-2xl font-black text-[#33261D] dark:text-[#F5F1EA] dark:text-[#F5F1EA]">{stats.reportsByDay.reduce((a:any, b:any) => a + b.count, 0)}</p>
                <p className="text-xs font-bold text-[#8C7A6B] dark:text-[#918982] uppercase tracking-wide">New Reports (7d)</p>
             </div>
          </div>
          <div className="bg-white dark:bg-[#2A2625] p-5 rounded-2xl border border-[#E5E0D8] dark:border-[#49433F] shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
             </div>
             <div>
                <p className="text-2xl font-black text-[#33261D] dark:text-[#F5F1EA] dark:text-[#F5F1EA]">{stats.totalResolved}</p>
                <p className="text-xs font-bold text-[#8C7A6B] dark:text-[#918982] uppercase tracking-wide">Total Resolved</p>
             </div>
          </div>
          <div className="bg-white dark:bg-[#2A2625] p-5 rounded-2xl border border-[#E5E0D8] dark:border-[#49433F] shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Clock className="w-6 h-6" />
             </div>
             <div>
                <p className="text-2xl font-black text-[#33261D] dark:text-[#F5F1EA] dark:text-[#F5F1EA]">{stats.avgResolveTime}</p>
                <p className="text-xs font-bold text-[#8C7A6B] dark:text-[#918982] uppercase tracking-wide">Avg Resolve Time</p>
             </div>
          </div>
          <div className="bg-white dark:bg-[#2A2625] p-5 rounded-2xl border border-[#E5E0D8] dark:border-[#49433F] shadow-sm flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <FileText className="w-6 h-6" />
             </div>
             <div>
                <p className="text-2xl font-black text-[#33261D] dark:text-[#F5F1EA] dark:text-[#F5F1EA]">{stats.totalReports}</p>
                <p className="text-xs font-bold text-[#8C7A6B] dark:text-[#918982] uppercase tracking-wide">Total Reports</p>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#2A2625] p-6 rounded-2xl border border-[#E5E0D8] dark:border-[#49433F] shadow-sm">
             <h3 className="font-bold text-[#33261D] dark:text-[#F5F1EA] dark:text-[#F5F1EA] mb-6">Reports per Day (Last 7 Days)</h3>
             <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={stats.reportsByDay}>
                   <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                   <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                   <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                   <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
          </div>
          
          <div className="bg-white dark:bg-[#2A2625] p-6 rounded-2xl border border-[#E5E0D8] dark:border-[#49433F] shadow-sm">
             <h3 className="font-bold text-[#33261D] dark:text-[#F5F1EA] dark:text-[#F5F1EA] mb-6">Reports by Category</h3>
             <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={stats.reportsByCategory}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={5}
                     dataKey="value"
                   >
                     {stats.reportsByCategory.map((entry: any, index: number) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                 </PieChart>
               </ResponsiveContainer>
             </div>
             <div className="flex flex-wrap gap-2 justify-center mt-4">
                {stats.reportsByCategory.map((entry: any, index: number) => (
                   <div key={index} className="flex items-center gap-1.5 text-xs text-[#8C7A6B] dark:text-[#C8C0B8] dark:text-[#918982]">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      {entry.name} ({entry.value})
                   </div>
                ))}
             </div>
          </div>
       </div>
    </div>
  );
};

export default AnalyticsView;
