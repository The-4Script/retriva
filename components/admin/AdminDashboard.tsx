import React, { useState, useEffect } from 'react';
import { User, ViewState } from '../../types';
import { Users, FileText, Settings, Wrench, MessageCircle, Shield, Activity, Bell, Menu, X, ChevronLeft } from 'lucide-react';
import UserManagement from './UserManagement';
import ReportsManagement from './ReportsManagement';
import ApiConfigManagement from './ApiConfigManagement';
import MaintenanceManagement from './MaintenanceManagement';
import AdminManagement from './AdminManagement';
import AuditLogView from './AuditLogView';
import AnalyticsView from './AnalyticsView';
// We'll import other modules as we build them

interface AdminDashboardProps {
  user: User;
  onNavigate: (view: ViewState) => void;
}

type AdminTab = 'USERS' | 'REPORTS' | 'API_CONFIG' | 'MAINTENANCE' | 'COMMUNITY' | 'ADMINS' | 'AUDIT_LOG' | 'ANALYTICS';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('USERS');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [showNotifications, setShowNotifications] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState([
     { id: 1, title: 'AI quota nearing limit', message: 'GPT-OSS 120B has used 85% of daily quota', type: 'warning' },
     { id: 2, title: 'New AI flag', message: 'Report "Keys found" flagged for policy violation', type: 'alert' }
  ]);

  const TABS = [
    { id: 'USERS', label: 'User Management', icon: Users },
    { id: 'REPORTS', label: 'Reports', icon: FileText },
    { id: 'API_CONFIG', label: 'AI Configuration', icon: Settings },
    { id: 'MAINTENANCE', label: 'Maintenance Mode', icon: Wrench },
    { id: 'COMMUNITY', label: 'Community Settings', icon: MessageCircle },
    { id: 'ADMINS', label: 'Manage Admins', icon: Shield },
    { id: 'AUDIT_LOG', label: 'Audit Log', icon: Activity },
    { id: 'ANALYTICS', label: 'Analytics', icon: Activity }, // Will change icon
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'USERS':
        return <UserManagement user={user} />;
      case 'REPORTS':
        return <ReportsManagement />;
      case 'API_CONFIG':
        return <ApiConfigManagement />;
      case 'MAINTENANCE':
        return <MaintenanceManagement />;
      case 'ADMINS':
        return <AdminManagement currentUser={user} />;
      case 'AUDIT_LOG':
        return <AuditLogView />;
      case 'ANALYTICS':
        return <AnalyticsView />;
      default:
        return <div className="p-8 text-center text-slate-500">Feature coming soon.</div>;
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
       {/* Sidebar */}
       <div className={`flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
             {isSidebarOpen && <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">Admin Control</span>}
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                <Menu className="w-5 h-5" />
             </button>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
             <nav className="space-y-1 px-3">
               {TABS.map(tab => (
                 <button 
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id as AdminTab)}
                   className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                   title={!isSidebarOpen ? tab.label : ''}
                 >
                    <tab.icon className="w-5 h-5 shrink-0" />
                    {isSidebarOpen && <span className="text-sm whitespace-nowrap">{tab.label}</span>}
                 </button>
               ))}
             </nav>
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
             <button onClick={() => onNavigate('DASHBOARD')} className={`w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors`}>
                <ChevronLeft className="w-4 h-4" />
                {isSidebarOpen && <span className="text-sm font-bold">Exit Admin</span>}
             </button>
          </div>
       </div>

       {/* Main Content Area */}
       <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex items-center justify-between px-6 shrink-0 z-10 relative">
             <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                {TABS.find(t => t.id === activeTab)?.label}
             </h2>
             <div className="flex items-center gap-4">
                <div className="relative">
                    <button 
                       onClick={() => setShowNotifications(!showNotifications)}
                       className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                       <Bell className="w-5 h-5" />
                       {adminNotifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>}
                    </button>
                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50">
                           <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                              <span className="font-bold text-sm text-slate-800 dark:text-white">Admin Alerts</span>
                              <button onClick={() => setAdminNotifications([])} className="text-[10px] font-bold text-slate-500 hover:text-indigo-600">Clear</button>
                           </div>
                           <div className="max-h-64 overflow-y-auto">
                              {adminNotifications.length === 0 ? (
                                 <div className="p-6 text-center text-xs text-slate-500">No new alerts.</div>
                              ) : (
                                 adminNotifications.map(n => (
                                     <div key={n.id} className="p-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <p className="text-xs font-bold text-slate-800 dark:text-white">{n.title}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                                     </div>
                                 ))
                              )}
                           </div>
                        </div>
                    )}
                </div>
                <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold overflow-hidden ring-2 ring-white dark:ring-slate-950">
                    {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : (user?.name?.charAt(0) || user?.email?.charAt(0) || 'A')}
                </div>
             </div>
          </header>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
             {renderContent()}
          </div>
       </div>
    </div>
  );
};

export default AdminDashboard;
