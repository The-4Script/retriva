import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { logAdminAction } from '../../services/adminService';
import { Wrench, Save, CheckCircle } from 'lucide-react';

const MaintenanceManagement = () => {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('We are currently undergoing scheduled maintenance. Please check back later.');
  const [estimatedEndTime, setEstimatedEndTime] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    db.collection('siteConfig').doc('global').get().then(snap => {
      if (snap.exists) {
        const data = snap.data();
        setEnabled(data?.maintenanceMode || false);
        if (data?.message) setMessage(data.message);
        if (data?.estimatedEndTime) {
            // convert timestamp to datetime-local string
            const date = new Date(data.estimatedEndTime);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            setEstimatedEndTime(date.toISOString().slice(0, 16));
        }
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const endTimestamp = estimatedEndTime ? new Date(estimatedEndTime).getTime() : null;
      
      await db.collection('siteConfig').doc('global').set({
        maintenanceMode: enabled,
        message,
        estimatedEndTime: endTimestamp
      }, { merge: true });
      
      await logAdminAction(`Toggle Maintenance: \${enabled ? 'ON' : 'OFF'}`, 'global', 'SYSTEM');
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="bg-white dark:bg-slate-950 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          
          <div className="flex items-center gap-4 mb-8">
             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center \${enabled ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                <Wrench className="w-7 h-7" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white">Maintenance Mode</h2>
                <p className="text-slate-500 text-sm mt-1">Restrict access to all non-admin users.</p>
             </div>
          </div>

          <div className="space-y-6">
             <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                   <p className="font-bold text-slate-800 dark:text-white">Enable Maintenance Mode</p>
                   <p className="text-xs text-slate-500 mt-0.5">App will immediately show the maintenance screen.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
                </label>
             </div>

             <div className="space-y-4">
                <div>
                   <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Message to Users</label>
                   <textarea 
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                   />
                </div>
                
                <div>
                   <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Estimated End Time (Optional)</label>
                   <input 
                      type="datetime-local" 
                      value={estimatedEndTime}
                      onChange={e => setEstimatedEndTime(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                   />
                </div>
             </div>

             <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                   {success && <p className="text-sm font-bold text-emerald-500 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Saved successfully</p>}
                </div>
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/30"
                >
                   {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-4 h-4" />}
                   Save Configuration
                </button>
             </div>
          </div>
       </div>
    </div>
  );
};

export default MaintenanceManagement;
