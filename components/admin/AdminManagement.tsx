import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { User } from '../../types';
import { logAdminAction } from '../../services/adminService';
import { Shield, UserPlus, Trash2, ShieldCheck, Mail } from 'lucide-react';

interface AdminRecord {
  id: string; // UID
  email: string;
  promotedAt: number;
  promotedBy: string;
}

const AdminManagement = ({ currentUser }: { currentUser: User }) => {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newEmail, setNewEmail] = useState('');
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = db.collection('admins').onSnapshot(snap => {
      const fetched = snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as AdminRecord[];
      setAdmins(fetched);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newEmail.trim()) return;
    
    setPromoting(true);
    try {
      // Find user by email
      const usersSnap = await db.collection('users').where('email', '==', newEmail.toLowerCase().trim()).limit(1).get();
      
      if (usersSnap.empty) {
        setError('No user found with this email.');
        return;
      }
      
      const targetUser = usersSnap.docs[0];
      
      if (admins.find(a => a.id === targetUser.id)) {
         setError('User is already an admin.');
         return;
      }
      
      if (confirm(`Are you sure you want to make ${newEmail} an admin? This grants full dashboard access.`)) {
          await db.collection('admins').doc(targetUser.id).set({
             email: newEmail.toLowerCase().trim(),
             promotedAt: Date.now(),
             promotedBy: currentUser.email
          });
          
          await logAdminAction('Promote Admin', targetUser.id, 'ADMIN');
          setNewEmail('');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setPromoting(false);
    }
  };

  const handleRemove = async (admin: AdminRecord) => {
    if (admins.length <= 1) {
      alert("Cannot remove the last remaining admin.");
      return;
    }
    
    if (admin.id === currentUser.id) {
       if (!confirm("You are about to remove your own admin privileges. You will be logged out of the dashboard. Continue?")) return;
    } else {
       if (!confirm(`Are you sure you want to remove admin privileges from ${admin.email}?`)) return;
    }
    
    try {
      await db.collection('admins').doc(admin.id).delete();
      await logAdminAction('Demote Admin', admin.id, 'ADMIN');
    } catch (e) {
      console.error("Failed to remove admin:", e);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       
       {/* PROMOTE SECTION */}
       <div className="bg-white dark:bg-[#2A2625] p-6 md:p-8 rounded-3xl border border-[#E5E0D8] dark:border-[#49433F] shadow-sm flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1">
             <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                   <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-black text-[#33261D] dark:text-[#F5F1EA] dark:text-[#F5F1EA]">Promote Admin</h3>
             </div>
             <p className="text-sm text-[#8C7A6B] dark:text-[#918982]">Grant another user full access to the admin dashboard.</p>
          </div>
          
          <div className="w-full md:w-96">
             <form onSubmit={handlePromote} className="flex gap-2">
                <div className="relative flex-1">
                   <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3978E] dark:text-[#918982]" />
                   <input 
                      type="email" 
                      placeholder="User's email address..." 
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-[#FAF8F5] dark:bg-[#302C2A] border border-[#E5E0D8] dark:border-[#49433F] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                   />
                </div>
                <button 
                  type="submit"
                  disabled={promoting || !newEmail}
                  className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-md"
                >
                   {promoting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Promote'}
                </button>
             </form>
             {error && <p className="text-xs font-bold text-rose-500 mt-2 pl-1">{error}</p>}
          </div>
       </div>

       {/* ADMINS LIST */}
       <div className="bg-white dark:bg-[#2A2625] rounded-3xl border border-[#E5E0D8] dark:border-[#49433F] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#E5E0D8] dark:border-[#49433F] flex items-center gap-3 bg-[#FAF8F5] dark:bg-[#302C2A]">
             <ShieldCheck className="w-5 h-5 text-teal-500" />
             <h3 className="font-bold text-[#33261D] dark:text-[#F5F1EA] dark:text-[#F5F1EA]">Current Administrators</h3>
             <span className="ml-auto bg-[#E5E0D8] dark:bg-[#373230] text-[#8C7A6B] dark:text-[#C8C0B8] dark:text-[#C8C0B8] text-xs font-bold px-2.5 py-0.5 rounded-full">{admins.length}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
             {admins.map(admin => (
                <div key={admin.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FAF8F5] dark:hover:bg-white dark:bg-[#302C2A]20 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center border border-teal-100 dark:border-teal-900/50">
                         <Shield className="w-6 h-6 text-teal-500" />
                      </div>
                      <div>
                         <p className="font-bold text-[#2C2724] dark:text-[#F5F1EA] flex items-center gap-2">
                            {admin.email}
                            {admin.id === currentUser.id && <span className="px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-[10px] uppercase tracking-wider">You</span>}
                         </p>
                         <p className="text-xs text-[#8C7A6B] dark:text-[#918982] mt-1">
                            Promoted by <span className="font-medium">{admin.promotedBy}</span> on {new Date(admin.promotedAt).toLocaleDateString()}
                         </p>
                      </div>
                   </div>
                   
                   <button 
                      onClick={() => handleRemove(admin)}
                      disabled={admins.length <= 1}
                      title={admins.length <= 1 ? "Cannot remove last admin" : "Remove admin"}
                      className="p-2.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20 rounded-xl transition-colors disabled:opacity-30"
                   >
                      <Trash2 className="w-5 h-5" />
                   </button>
                </div>
             ))}
          </div>
       </div>

    </div>
  );
};

export default AdminManagement;
