import React, { useState, useEffect } from 'react';
import { User, ViewState } from '../../types';
import { Users, FileText, Settings, Wrench, MessageCircle, Shield, Activity, Bell, Menu, X, ChevronLeft } from 'lucide-react';
import UserManagement from './UserManagement';
import ReportsManagement from './ReportsManagement';
import MaintenanceManagement from './MaintenanceManagement';
import AdminManagement from './AdminManagement';
import AuditLogView from './AuditLogView';
import AnalyticsView from './AnalyticsView';

// We'll import other modules as we build them

interface AdminDashboardProps {
  user: User;
  onNavigate: (view: ViewState) => void;
}

type AdminTab = 'USERS' | 'REPORTS' | 'MAINTENANCE' | 'ADMINS' | 'AUDIT_LOG' | 'ANALYTICS';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('USERS');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const TABS = [
    { id: 'USERS', label: 'User Management', icon: Users },
    { id: 'REPORTS', label: 'Reports', icon: FileText },
    { id: 'MAINTENANCE', label: 'Maintenance Mode', icon: Wrench },
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
             {isSidebarOpen && <span className="font-bold text-lg text-teal-600 dark:text-teal-400">Admin Control</span>}
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
                   className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
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
                <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold overflow-hidden ring-2 ring-white dark:ring-slate-950">
                    {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : (user.name || '?').charAt(0)}
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
