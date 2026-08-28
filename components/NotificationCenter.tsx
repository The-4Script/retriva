
import React from 'react';
import { AppNotification, ViewState } from '../types';
import { Bell, Sparkles, MessageCircle, ShieldCheck, X, CheckCheck, Trash2, ChevronRight } from 'lucide-react';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNavigate: (view: ViewState) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNavigate
}) => {
  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'match': return <Sparkles className="w-5 h-5 text-amber-500" />;
      case 'message': return <MessageCircle className="w-5 h-5 text-brand-teal" />;
      default: return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
    }
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
      {/* FOCUS & DEPTH: Dimmer backdrop blur overlay */}
      <div 
        className="fixed inset-0 z-[140] bg-white dark:bg-[#302C2A]/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose} 
      />
      
      {/* POSITIONING: Fixed positioning to escape sticky nav stacking context on all screens */}
      <div className="fixed top-24 left-4 right-4 sm:top-24 sm:right-6 sm:left-auto sm:w-[420px] bg-white/95 dark:bg-[#302C2A] backdrop-blur-2xl rounded-[2.5rem] shadow-[0_40px_120px_rgba(0,0,0,0.2)] dark:shadow-none border border-white dark:border-[#49433F] overflow-hidden z-[150] animate-in zoom-in-95 fade-in duration-300 origin-top-right flex flex-col max-h-[75vh]">
        
        {/* Header */}
        <div className="px-7 py-6 border-b border-[#E5E0D8] dark:border-[#49433F] bg-white/50 dark:bg-[#302C2A] backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h3 className="font-black text-xl text-[#33261D] dark:text-[#F5F1EA] dark:text-[#F5F1EA] tracking-tight">Activity</h3>
            {unreadCount > 0 && (
              <span className="px-3 py-1 bg-brand-teal text-white text-[10px] font-black rounded-full shadow-lg shadow-brand-teal/20 uppercase tracking-widest">
                {unreadCount} New
              </span>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-[#A3978E] dark:text-[#918982] hover:text-[#33261D] dark:text-[#F5F1EA] dark:hover:text-white transition-all rounded-full hover:bg-[#F5F2ED] dark:hover:bg-[#F5F2ED] dark:bg-[#373230] hover:rotate-90"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List Content: Styled Thin Teal Scrollbar */}
        <div className="overflow-y-auto flex-1 notification-scrollbar scroll-smooth bg-white dark:bg-[#302C2A]">
          {notifications.length === 0 ? (
            <div className="py-20 px-10 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-teal-50 dark:bg-[#373230] rounded-full flex items-center justify-center mb-6 ring-1 ring-teal-100 dark:ring-slate-700">
                <Bell className="w-10 h-10 text-teal-200 dark:text-[#8C7A6B] dark:text-[#C8C0B8]" />
              </div>
              <p className="text-[#2C2724] dark:text-[#F5F1EA] font-black text-lg tracking-tight">Zero notifications</p>
              <p className="text-sm text-[#8C7A6B] dark:text-[#918982] dark:text-[#918982] mt-2 max-w-[220px] font-medium leading-relaxed">
                When people interact with your reports, they'll appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  onClick={() => {
                    onMarkAsRead(notification.id);
                    if (notification.link) {
                        onNavigate(notification.link);
                    }
                  }}
                  className={`relative p-6 flex gap-4 cursor-pointer transition-all hover:bg-[#FAF8F5] dark:hover:bg-[#F5F2ED] dark:bg-[#373230]50 group ${
                    !notification.isRead ? 'bg-brand-teal/5 dark:bg-brand-teal/10' : ''
                  }`}
                >
                  {/* Unread Indicator */}
                  {!notification.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-teal"></div>
                  )}

                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-[1.25rem] shrink-0 flex items-center justify-center shadow-sm border border-[#E5E0D8] dark:border-[#49433F]/50 ${
                    notification.type === 'match' ? 'bg-amber-50 dark:bg-amber-900/20' :
                    notification.type === 'message' ? 'bg-teal-50 dark:bg-teal-900/20' :
                    'bg-emerald-50 dark:bg-emerald-900/20'
                  }`}>
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex justify-between items-start mb-1.5">
                      <p className={`text-sm font-black truncate pr-2 ${
                        !notification.isRead ? 'text-[#2C2724] dark:text-[#F5F1EA]' : 'text-[#8C7A6B] dark:text-[#C8C0B8] dark:text-[#918982]'
                      }`}>
                        {notification.title}
                      </p>
                      <span className="text-[10px] font-black text-[#A3978E] dark:text-[#918982] whitespace-nowrap bg-[#F5F2ED] dark:bg-[#373230] px-2 py-0.5 rounded-lg">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                    
                    <p className={`text-xs leading-relaxed line-clamp-2 font-medium ${
                       !notification.isRead ? 'text-[#8C7A6B] dark:text-[#C8C0B8] dark:text-[#C8C0B8]' : 'text-[#A3978E] dark:text-[#918982] dark:text-[#8C7A6B] dark:text-[#918982]'
                    }`}>
                      {notification.message}
                    </p>

                    {notification.link && (
                       <div className="mt-2.5 flex items-center text-[10px] font-black text-brand-teal opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                          VIEW UPDATE <ChevronRight className="w-3 h-3 ml-1" />
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: INTERACTIVITY - Mark All as Read & Clear All */}
        {notifications.length > 0 && (
          <div className="p-5 bg-[#FAF8F5]80 dark:bg-[#302C2A] backdrop-blur-md border-t border-[#E5E0D8] dark:border-[#49433F] grid grid-cols-2 gap-3">
            <button 
              onClick={(e) => { e.stopPropagation(); onMarkAllAsRead(); }}
              disabled={unreadCount === 0}
              className="py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest bg-white dark:bg-[#373230] text-[#8C7A6B] dark:text-[#C8C0B8] dark:text-[#C8C0B8] border border-[#E5E0D8] dark:border-[#49433F] transition-all hover:bg-brand-teal/5 dark:hover:bg-brand-teal/10 hover:text-brand-teal disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <CheckCheck className="w-4 h-4 group-hover:scale-110 transition-transform" /> Mark as Read
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onClearAll(); }}
              className="py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#8C7A6B] dark:text-[#918982] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/40 group"
            >
              <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" /> Clear History
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationCenter;
