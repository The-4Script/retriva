import React from 'react';
import { BellRing, X } from 'lucide-react';

interface NotificationPermissionBannerProps {
  onEnable: () => void;
  onDismiss: () => void;
}

const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({ onEnable, onDismiss }) => {
  return (
    <div className="fixed bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:w-[380px] z-[130] animate-in slide-in-from-bottom-8 fade-in duration-300">
      <div className="relative overflow-hidden bg-white/95 dark:bg-[#302C2A] backdrop-blur-2xl border border-[#E5E0D8] dark:border-[#49433F] shadow-[0_30px_80px_rgba(0,0,0,0.18)] dark:shadow-none rounded-[1.75rem] p-5 flex items-start gap-4">
        <div className="w-12 h-12 shrink-0 rounded-2xl bg-brand-teal/10 flex items-center justify-center">
          <BellRing className="w-6 h-6 text-brand-teal" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-[#2C2724] dark:text-[#F5F1EA]">Turn on notifications?</p>
          <p className="text-xs font-medium text-[#8C7A6B] dark:text-[#918982] mt-1 leading-relaxed">
            Get alerted about new messages and potential matches for your items, even when this tab isn't in front of you.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onEnable}
              className="px-4 py-2 rounded-xl bg-brand-teal text-white text-[11px] font-black uppercase tracking-widest hover:bg-brand-teal/90 transition-colors"
            >
              Enable
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-[#8C7A6B] dark:text-[#918982] hover:bg-[#F5F2ED] dark:hover:bg-[#373230] transition-colors"
            >
              Not now
            </button>
          </div>
        </div>

        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-[#A3978E] dark:text-[#918982] hover:text-[#2C2724] dark:hover:text-white transition-colors p-1 rounded-full hover:bg-[#F5F2ED] dark:hover:bg-[#373230] shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default NotificationPermissionBanner;
