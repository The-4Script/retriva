import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { User } from '../../types';
import { logAdminAction } from '../../services/adminService';
import { Search, Filter, MoreVertical, ShieldAlert, CheckCircle, Ban, Edit, Activity, UserX, UserCheck, Users } from 'lucide-react';

export interface AdminUser extends User {
  status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  createdAt: number;
}

const UserManagement = ({ user: currentUser }: { user: User }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLOCKED'>('ALL');
  
  // Stats
  const totalUsers = users.length;
  const verifiedUsers = users.filter(u => u.isVerified).length;
  const suspendedBlockedUsers = users.filter(u => u.status === 'SUSPENDED' || u.status === 'BLOCKED').length;
  const newSignups = users.filter(u => u.createdAt > Date.now() - 7 * 24 * 60 * 60 * 1000).length;

  useEffect(() => {
    const unsub = db.collection('users').limit(100).onSnapshot(snap => {
      let fetched = snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        status: doc.data().status || 'ACTIVE',
        createdAt: doc.data().createdAt || Date.now()
      })) as AdminUser[];
      
      // Filter out dummy or incomplete users (e.g. login attempt shells)
      fetched = fetched.filter(u => u.email && u.name);

      // Deduplicate by email to avoid UI glitches
      const seen = new Set();
      fetched = fetched.filter(u => {
          if (seen.has(u.email.toLowerCase())) return false;
          seen.add(u.email.toLowerCase());
          return true;
      });

      // Sort in memory to avoid missing index errors
      fetched.sort((a, b) => b.createdAt - a.createdAt);
      
      setUsers(fetched);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleStatusChange = async (targetUser: AdminUser, newStatus: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED', reason?: string) => {
    if (targetUser.id === currentUser.id) return; // Can't suspend self
    
    try {
      await db.collection('users').doc(targetUser.id).update({
        status: newStatus
      });
      await logAdminAction(`User Status: ${newStatus}`, targetUser.id, 'USER', reason);
      
      if (newStatus === 'SUSPENDED' || newStatus === 'BLOCKED') {
        // Find and hide active reports
        const reportsSnap = await db.collection('reports').where('reporterId', '==', targetUser.id).where('status', '==', 'OPEN').get();
        const batch = db.batch();
        reportsSnap.docs.forEach(doc => {
            batch.update(doc.ref, { hidden: true, hiddenReason: 'USER_SUSPENDED' });
        });
        await batch.commit();
      }
    } catch (e) {
      console.error("Status change failed:", e);
    }
  };

  const handleVerifyToggle = async (targetUser: AdminUser) => {
    try {
      await db.collection('users').doc(targetUser.id).update({
        isVerified: !targetUser.isVerified
      });
      await logAdminAction(`User Verify: ${!targetUser.isVerified}`, targetUser.id, 'USER');
    } catch (e) {
      console.error("Verification toggle failed:", e);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.studentId && u.studentId.includes(searchQuery));
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Verified Accounts', value: verifiedUsers, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Restricted', value: suspendedBlockedUsers, icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
          { label: 'New (7 Days)', value: newSignups, icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm">
             <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
             </div>
             <div>
                <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stat.value}</p>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wide">{stat.label}</p>
             </div>
          </div>
        ))}
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
         <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, email, or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
         </div>
         <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select 
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 md:w-40"
            >
               <option value="ALL">All Status</option>
               <option value="ACTIVE">Active</option>
               <option value="SUSPENDED">Suspended</option>
               <option value="BLOCKED">Blocked</option>
            </select>
         </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                     <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                     <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                     <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                     <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Verified</th>
                     <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredUsers.map(u => (
                     <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="p-4">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                                 {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <span className="font-bold text-indigo-500">{(u.name || '?').charAt(0)}</span>}
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {u.name}
                                    {u.id === currentUser.id && <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[9px] uppercase tracking-wider">You</span>}
                                 </p>
                                 <p className="text-xs text-slate-500 font-mono mt-0.5">{u.studentId || 'No ID'}</p>
                              </div>
                           </div>
                        </td>
                        <td className="p-4">
                           <p className="text-sm text-slate-600 dark:text-slate-300">{u.email}</p>
                           {u.department && <p className="text-xs text-slate-500 mt-0.5">{u.department}</p>}
                        </td>
                        <td className="p-4">
                           <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                              ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                                u.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 
                                'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}
                           `}>
                              {u.status === 'ACTIVE' ? <CheckCircle className="w-3 h-3" /> : u.status === 'SUSPENDED' ? <ShieldAlert className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                              {u.status}
                           </span>
                        </td>
                        <td className="p-4">
                           <button 
                             onClick={() => handleVerifyToggle(u)}
                             className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${u.isVerified ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                           >
                             {u.isVerified ? 'Verified' : 'Unverified'}
                           </button>
                        </td>
                        <td className="p-4 text-right relative group">
                           {u.id !== currentUser.id && (
                               <div className="flex items-center justify-end gap-2">
                                  {u.status !== 'ACTIVE' ? (
                                     <button onClick={() => handleStatusChange(u, 'ACTIVE')} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Unblock / Reactivate">
                                        <UserCheck className="w-4 h-4" />
                                     </button>
                                  ) : (
                                     <button onClick={() => {
                                        const reason = prompt("Reason for suspension (spam, fake reports, abuse):", "Violation of terms");
                                        if (reason) handleStatusChange(u, 'SUSPENDED', reason);
                                     }} className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Suspend User">
                                        <ShieldAlert className="w-4 h-4" />
                                     </button>
                                  )}
                                  {u.status !== 'BLOCKED' && (
                                      <button onClick={() => {
                                        if (confirm(`Are you sure you want to PERMANENTLY BLOCK ${u.name}?`)) handleStatusChange(u, 'BLOCKED', 'Permanent Ban');
                                      }} className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="Block User">
                                         <UserX className="w-4 h-4" />
                                      </button>
                                  )}
                               </div>
                           )}
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
            
            {filteredUsers.length === 0 && (
               <div className="p-12 text-center text-slate-500">
                  No users found matching your criteria.
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default UserManagement;
