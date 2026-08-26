import { db, auth } from './firebase';

export interface AuditLog {
  id: string;
  actorEmail: string;
  actorUid: string;
  action: string;
  targetId: string;
  targetType: string;
  reason?: string;
  timestamp: number;
}

export const logAdminAction = async (action: string, targetId: string, targetType: string, reason?: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  
  try {
    const logEntry = {
      actorEmail: currentUser.email || 'unknown',
      actorUid: currentUser.uid,
      action,
      targetId,
      targetType,
      reason: reason || '',
      timestamp: Date.now()
    };
    
    await db.collection('auditLogs').add(logEntry);
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
};
