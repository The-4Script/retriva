
import React, { useEffect } from 'react';
import { X, Bot, ShieldAlert, Eye, Server, Scale, FileText, CheckCircle2 } from 'lucide-react';

interface AIDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIDisclaimerModal: React.FC<AIDisclaimerModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-950 w-full max-w-2xl max-h-[85vh] rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                 <Scale className="w-5 h-5" />
              </div>
              <div>
                 <h2 className="text-lg font-black text-slate-900 dark:text-white leading-none mb-1">AI Usage & Legal Disclaimer</h2>
                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Terms of Service</p>
              </div>
           </div>
           <button 
             onClick={onClose}
             className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
           >
             <X className="w-5 h-5" />
           </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
           
           {/* Section 1: Core Disclaimer (User Provided) */}
           <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                 <Bot className="w-5 h-5 text-brand-violet" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">AI Usage Policy</h3>
              </div>
              <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
                 <p className="font-bold text-indigo-900 dark:text-indigo-200">
                    This website uses Artificial Intelligence (AI) to assist in matching lost and found items, generating content, and powering our support chatbot. Our goal is to streamline the recovery process.
                 </p>
                 <ul className="space-y-3">
                    <li className="flex gap-3">
                       <ShieldAlert className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                       <span>
                         <strong className="text-slate-900 dark:text-white">Accuracy Not Guaranteed:</strong> AI systems learn from data patterns and may generate responses or matches that are inaccurate, incomplete, or contain errors ("hallucinations").
                       </span>
                    </li>
                    <li className="flex gap-3">
                       <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                       <span>
                         <strong className="text-slate-900 dark:text-white">Human Review Recommended:</strong> We strongly advise users to independently verify all critical information and AI-generated matches. Do not rely on AI outputs as the sole source of truth.
                       </span>
                    </li>
                    <li className="flex gap-3">
                       <FileText className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                       <span>
                         <strong className="text-slate-900 dark:text-white">Limitation of Liability:</strong> We are not responsible for any consequences, damages, or losses that may arise from your reliance on AI-generated content or results. Your use of AI features is at your own risk.
                       </span>
                    </li>
                 </ul>
              </div>
           </section>

           {/* Section 2: Technical Specifics (Added Points) */}
           <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                 <Server className="w-5 h-5 text-emerald-500" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Data Processing & Privacy</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wide">
                       <Eye className="w-4 h-4" /> Visual Analysis
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                       Images uploaded to Retriva are processed by <strong>Groq Vision</strong> to extract details (brand, color, type). By uploading, you grant us permission to process this visual data for categorization purposes.
                    </p>
                 </div>

                 <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wide">
                       <ShieldAlert className="w-4 h-4" /> PII Redaction
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                       Our "Guardian AI" attempts to automatically blur faces and ID cards. <span className="font-bold">This is not 100% foolproof.</span> You are strictly prohibited from intentionally uploading high-resolution images of sensitive documents (Passports, Credit Cards).
                    </p>
                 </div>
              </div>
           </section>

           <div className="text-[11px] text-slate-400 text-center pt-4 border-t border-slate-100 dark:border-slate-800">
              Data & Privacy: Information shared may be used to improve our AI services and overall platform. Please avoid sharing highly sensitive personal or confidential information via public-facing AI tools.
           </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
           <button 
             onClick={onClose}
             className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
           >
             I Understand
           </button>
        </div>

      </div>
    </div>
  );
};

export default AIDisclaimerModal;
