
import React, { useEffect } from 'react';
import { Bell, X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'info' | 'alert';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
    alert: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
    info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' }
  };

  const { icon: Icon, color, bg, border } = config[type] || config.info;

  return (
    <div className="fixed top-24 right-4 z-[120] animate-in slide-in-from-right-10 fade-in duration-300">
      <div className={`relative overflow-hidden backdrop-blur-xl bg-white/95 dark:bg-[#302C2A] border ${border} shadow-2xl shadow-[#E5E0D8]/50 dark:shadow-none rounded-2xl p-4 flex items-start gap-4 max-w-sm w-[360px]`}>
        
        {/* Progress bar animation could go here, but keeping it simple for now */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${color.replace('text', 'bg')}`}></div>

        <div className={`p-2 rounded-xl shrink-0 ${bg}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        
        <div className="flex-1 pt-0.5">
          <p className="text-sm font-bold text-[#33261D] dark:text-[#F5F1EA] dark:text-[#F5F1EA] mb-0.5 capitalize">{type}</p>
          <p className="text-xs font-medium text-[#8C7A6B] dark:text-[#918982] dark:text-[#918982] leading-relaxed">{message}</p>
        </div>
        
        <button 
          onClick={onClose}
          className="text-[#A3978E] dark:text-[#918982] hover:text-[#8C7A6B] dark:text-[#C8C0B8] dark:hover:text-[#F5F1EA] transition-colors p-1 hover:bg-[#F5F2ED] dark:hover:bg-[#F5F2ED] dark:bg-[#373230] rounded-full"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
