
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chat, User, Message } from '../types';
import { Send, Search, ArrowLeft, MessageCircle, Check, CheckCheck, Paperclip, File, ShieldBan, ShieldCheck, Lock, Globe, Users, Trash2, Home, X, Pin, ChevronDown, Clock, Image as ImageIcon } from 'lucide-react';
import { db, FieldValue } from '../services/firebase';
import { uploadImage } from '../services/cloudinary';

interface ChatViewProps {
  user: User;
  onBack: () => void;
  onNotification: (title: string, body: string) => void;
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string | null) => void;
  onBlockChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  isAdmin?: boolean;
}

const ChatView: React.FC<ChatViewProps> = ({ user, onBack, onNotification, chats, activeChatId, onSelectChat, onBlockChat, onDeleteChat, isAdmin }) => {
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  
  // Enhanced Online/Last Seen State
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<number | null>(null);
  
  const [subcollectionMessages, setSubcollectionMessages] = useState<Message[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const [adminIds, setAdminIds] = useState<string[]>([]);

  useEffect(() => {
    // Fetch all admin UIDs for badge rendering
    const unsub = db.collection('admins').onSnapshot(snap => {
       setAdminIds(snap.docs.map(d => d.id));
    });
    return () => unsub();
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const selectedChat = chats.find(c => c.id === activeChatId);
  const isGlobal = selectedChat?.type === 'global';
  
  // Logic to determine if blocked and by whom
  const isBlocked = selectedChat?.isBlocked || false;
  const iBlockedThem = selectedChat?.blockedBy === user.id;
  const theyBlockedMe = isBlocked && !iBlockedThem;

  const otherParticipantId = useMemo(() => {
     return selectedChat?.participants.find(p => p !== user.id);
  }, [selectedChat, user.id]);

  const pinnedMessage = selectedChat?.pinnedMessageId ? subcollectionMessages.find(m => m.id === selectedChat.pinnedMessageId) : null;

  // --- 1. FETCH MESSAGES ---
  useEffect(() => {
    if (!activeChatId) {
        setSubcollectionMessages([]);
        return;
    }

    // Explicitly clear messages when ID changes to avoid flicker
    setSubcollectionMessages([]);

    // Temporary fix: Removing the hard limit of 50 to allow all messages to load
    // so historical truncation does not occur. We will implement proper pagination later.
    const messagesRef = db.collection('chats').doc(activeChatId).collection('messages');
    const q = messagesRef.orderBy('timestamp', 'asc');

    const unsubscribe = q.onSnapshot((snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Message[];
        setSubcollectionMessages(msgs);
    }, (error) => {
        console.error("Error fetching subcollection messages:", error);
    });

    return () => {
        unsubscribe();
    };
  }, [activeChatId]);

  // --- 2. MERGE MESSAGES ---
  const allMessages = useMemo(() => {
     const legacyMessages = selectedChat?.messages || [];
     const messageMap = new Map();
     
     legacyMessages.forEach(m => messageMap.set(m.id || m.timestamp, m));
     subcollectionMessages.forEach(m => messageMap.set(m.id || m.timestamp, m));
     
     const combined = Array.from(messageMap.values());
     return combined.sort((a, b) => a.timestamp - b.timestamp);
  }, [selectedChat?.messages, subcollectionMessages]);

  // --- 3. ROBUST MARK AS READ LOGIC ---
  useEffect(() => {
    if (activeChatId && selectedChat) {
       
       // A. Check for individual unread messages
       const unreadDocs = subcollectionMessages.filter(m => m.senderId !== user.id && m.status !== 'read');
       const batch = db.batch();
       let needsUpdate = false;

       // Mark individual messages as read
       if (unreadDocs.length > 0) {
           unreadDocs.forEach(msg => {
               if (msg.id) {
                   const docRef = db.collection('chats').doc(activeChatId).collection('messages').doc(msg.id);
                   batch.update(docRef, { status: 'read' });
               }
           });
           needsUpdate = true;
       }

       // B. FORCE RESET Unread Count if I am viewing the chat and I wasn't the last sender
       // This fixes the "stuck" indicator issue.
       if (selectedChat.unreadCount > 0 && selectedChat.lastSenderId !== user.id) {
           const chatRef = db.collection('chats').doc(activeChatId);
           batch.update(chatRef, { unreadCount: 0 });
           needsUpdate = true;
       }

       if (needsUpdate) {
           batch.commit().catch(e => console.error("Error marking read:", e));
       }
    }
  }, [activeChatId, subcollectionMessages, user.id, selectedChat?.unreadCount, selectedChat?.lastSenderId]);

  // --- 4. ONLINE STATUS ---
  useEffect(() => {
     if (!otherParticipantId || isGlobal) {
        setOtherUserOnline(false);
        setOtherUserLastSeen(null);
        return;
     }
     
     const userRef = db.collection('users').doc(otherParticipantId);
     const unsubscribe = userRef.onSnapshot((snap) => {
        if (snap.exists) {
            const data = snap.data();
            setOtherUserOnline(data?.isOnline || false);
            setOtherUserLastSeen(data?.lastSeen || null);
        } else {
            setOtherUserOnline(false);
            setOtherUserLastSeen(null);
        }
     });

     return () => unsubscribe();
  }, [otherParticipantId, isGlobal]);

  // --- 5. SCROLLING ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (allMessages.length > 0) {
      const container = scrollContainerRef.current;
      if (container) {
          const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 400;
          if (isNearBottom) {
              scrollToBottom();
          }
      } else {
          scrollToBottom();
      }
    }
  }, [allMessages.length, activeChatId]);

  const handleScroll = () => {
      const container = scrollContainerRef.current;
      if (container) {
          const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
          setShowScrollButton(distanceToBottom > 300);
      }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeChatId) return;
    if (!confirm("Delete this message? This action is irreversible.")) return;
    try {
        await db.collection('chats').doc(activeChatId).collection('messages').doc(messageId).delete();
        // Log action if isAdmin
        if (isAdmin) {
            const { logAdminAction } = await import('../services/adminService');
            await logAdminAction('Delete Message', messageId, 'COMMUNITY');
        }
    } catch (e) {
        console.error("Failed to delete message", e);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!activeChatId || !isAdmin) return;
    try {
        await db.collection('chats').doc(activeChatId).update({
            pinnedMessageId: messageId ? messageId : FieldValue.delete()
        });
        const { logAdminAction } = await import('../services/adminService');
        await logAdminAction(messageId ? 'Pin Message' : 'Unpin Message', messageId || activeChatId, 'COMMUNITY');
    } catch (e) {
        console.error("Failed to pin message", e);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, attachment?: Message['attachment']) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !attachment) || !activeChatId || theyBlockedMe) return;

    const textToSend = newMessage;
    setNewMessage('');

    const timestamp = Date.now();
    const msgData: any = {
      senderId: user.id,
      senderName: user.name,
      text: textToSend,
      timestamp: timestamp,
      status: 'sent',
    };

    if (attachment) {
      msgData.attachment = attachment;
    }

    try {
      const messagesRef = db.collection('chats').doc(activeChatId).collection('messages');
      await messagesRef.add(msgData);

      const chatRef = db.collection('chats').doc(activeChatId);
      await chatRef.update({
        lastMessage: attachment ? (attachment.type === 'image' ? 'Sent a photo' : 'Sent a file') : textToSend,
        lastMessageTime: timestamp,
        lastSenderId: user.id, 
        deletedIds: [],
        unreadCount: FieldValue.increment(1) 
      });
      
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please check your connection.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeChatId && !theyBlockedMe) {
       try {
         const secureUrl = await uploadImage(file);
         handleSendMessage(undefined, {
           type: file.type.startsWith('image/') ? 'image' : 'file',
           url: secureUrl
         });
       } catch (error) {
         console.error("Failed to upload file:", error);
         alert("Failed to upload attachment.");
       }
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (timestamp: number) => {
      const diff = Date.now() - timestamp;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return 'a while ago';
  };

  const filteredChats = chats.filter(c => 
      c.itemTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-160px)] bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden border border-slate-100 dark:border-slate-800 flex relative">
      
      {/* Lightbox */}
      {lightboxImg && (
          <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
              <button className="absolute top-5 right-5 text-white p-2 rounded-full bg-white/10 hover:bg-white/20"><X className="w-8 h-8" /></button>
              <img src={lightboxImg} className="max-h-full max-w-full rounded-md shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
      )}

      {/* --- SIDEBAR: CHAT LIST --- */}
      <div className={`w-full md:w-80 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 z-10">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Messages</h2>
              <button onClick={onBack} className="p-2 text-slate-400 hover:text-brand-violet transition-colors rounded-full hover:bg-off-white dark:hover:bg-slate-800">
                 <Home className="w-5 h-5" />
              </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border-none outline-none focus:ring-1 focus:ring-brand-violet text-sm font-medium transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filteredChats.map(chat => {
            const isMeLastSender = chat.lastSenderId === user.id;
            const hasUnread = chat.unreadCount > 0 && !isMeLastSender;
            const isActive = activeChatId === chat.id;

            return (
                <div 
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`relative p-3 rounded-2xl cursor-pointer transition-all duration-200 border border-transparent ${
                      isActive 
                      ? 'bg-indigo-50 dark:bg-slate-800 border-indigo-100 dark:border-slate-700 shadow-sm' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                      {/* Avatar & Online Dot */}
                      <div className="relative shrink-0">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm overflow-hidden ${
                              chat.type === 'global' 
                              ? 'bg-gradient-to-br from-indigo-500 to-cyan-500' 
                              : 'bg-gradient-to-br from-indigo-400 to-purple-500'
                          }`}>
                              {chat.itemImage ? (
                                  <img src={chat.itemImage} className="w-full h-full object-cover" />
                              ) : (
                                  chat.type === 'global' ? <Globe className="w-6 h-6" /> : (chat.itemTitle ? chat.itemTitle.charAt(0) : '#')
                              )}
                          </div>
                          
                          {/* Visual Indicator: Online Dot or Blocked Icon */}
                          {chat.isBlocked ? (
                              <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1 border-2 border-white dark:border-slate-900 shadow-sm">
                                  <ShieldBan className="w-2 h-2 text-white" />
                              </div>
                          ) : (
                              // Only show online dot for DM if logic permits (complex for list, simplifying to 'active' implies viewed)
                              // Actual logic: We assume list doesn't track every user's online state unless we load them. 
                              // For now, let's show a dot if it's the active chat and we know they are online.
                              (isActive && otherUserOnline && chat.type !== 'global') && (
                                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></div>
                              )
                          )}
                      </div>

                      <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                              <h3 className={`font-bold text-sm truncate ${isActive ? 'text-indigo-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                  {chat.itemTitle}
                              </h3>
                              <span className={`text-[10px] font-bold ${hasUnread ? 'text-brand-violet' : 'text-slate-400'}`}>
                                  {formatTime(chat.lastMessageTime)}
                              </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                              <p className={`text-xs truncate font-medium max-w-[80%] ${hasUnread ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500'}`}>
                                  {chat.lastSenderId === user.id && <span className="text-slate-400 mr-1">You:</span>}
                                  {chat.isBlocked ? <span className="text-red-500 italic">Blocked</span> : chat.lastMessage}
                              </p>
                              
                              {/* Unread Badge - Visual Indicator Fix */}
                              {hasUnread && (
                                  <span className="w-5 h-5 flex items-center justify-center bg-brand-violet text-white text-[10px] font-bold rounded-full shadow-md shadow-indigo-500/30 animate-in zoom-in">
                                      {chat.unreadCount}
                                  </span>
                              )}
                          </div>
                      </div>
                  </div>
                </div>
            );
          })}
        </div>
      </div>

      {/* --- MAIN CHAT AREA --- */}
      <div className={`flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 ${!activeChatId ? 'hidden md:flex' : 'flex'} relative`}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shadow-sm z-20 shrink-0">
               <div className="flex items-center gap-3">
                 <button onClick={() => onSelectChat(null)} className="md:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                   <ArrowLeft className="w-5 h-5" />
                 </button>
                 
                 <div className="relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold overflow-hidden ${
                        isGlobal ? 'bg-indigo-500' : 'bg-gradient-to-br from-indigo-400 to-purple-600'
                    }`}>
                        {selectedChat.itemImage ? (
                            <img src={selectedChat.itemImage} className="w-full h-full object-cover" />
                        ) : (
                            isGlobal ? <Globe className="w-5 h-5" /> : (selectedChat.itemTitle ? selectedChat.itemTitle.charAt(0) : '#')
                        )}
                    </div>
                    {/* Header Online Indicator */}
                    {!isGlobal && !isBlocked && otherUserOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 ring-1 ring-emerald-500/20"></div>
                    )}
                 </div>

                 <div>
                   <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight flex items-center gap-2">
                       {selectedChat.itemTitle}
                       {isBlocked && <ShieldBan className="w-3 h-3 text-red-500" />}
                   </h3>
                   <div className="flex items-center gap-1.5 h-4">
                     {isBlocked ? (
                       <span className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
                         Messaging Unavailable
                       </span>
                     ) : (
                       isGlobal ? (
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide flex items-center gap-1">
                             <Users className="w-3 h-3" /> Community Channel
                          </span>
                       ) : (
                          <>
                           <span className={`text-[10px] font-bold ${otherUserOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                             {otherUserOnline ? 'Active Now' : (otherUserLastSeen ? `Last seen ${formatLastSeen(otherUserLastSeen)}` : 'Offline')}
                           </span>
                          </>
                       )
                     )}
                   </div>
                 </div>
               </div>
               
               <div className="flex gap-2">
                 {!isGlobal && (
                    <>
                        <button 
                            onClick={() => onBlockChat(selectedChat.id)} 
                            className={`p-2 rounded-xl transition-all ${
                                iBlockedThem 
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600' 
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500'
                            }`}
                            title={iBlockedThem ? "Unblock User" : "Block User"}
                        >
                            {iBlockedThem ? <ShieldCheck className="w-5 h-5" /> : <ShieldBan className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={() => {
                                if(window.confirm("Delete this conversation?")) 
                                onDeleteChat(selectedChat.id);
                            }}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </>
                 )}
               </div>
            </div>

            {/* Messages Stream */}
            <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-2 relative scroll-smooth">
              
              {/* Blocked Banner */}
              {theyBlockedMe && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3 rounded-xl text-center mb-4">
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
                          <ShieldBan className="w-4 h-4" /> You have been blocked by this user.
                      </p>
                  </div>
              )}

              {/* Pinned Message */}
              {pinnedMessage && (
                  <div className="sticky top-2 z-20 mb-4 flex justify-center">
                     <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-indigo-200 dark:border-indigo-900/50 p-3 rounded-xl max-w-sm w-full shadow-lg flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5"><Pin className="w-3 h-3" /> Pinned Announcement</span>
                            {isAdmin && (
                                <button onClick={() => handlePinMessage('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                   <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2">{pinnedMessage.text}</p>
                     </div>
                  </div>
              )}

              {allMessages.map((msg, idx) => {
                const isMe = msg.senderId === user.id;
                
                // Grouping Logic
                const prevMsg = allMessages[idx - 1];
                const nextMsg = allMessages[idx + 1];
                const isSameSenderAsPrev = prevMsg && prevMsg.senderId === msg.senderId;
                const isSameSenderAsNext = nextMsg && nextMsg.senderId === msg.senderId;
                const isGroupStart = !isSameSenderAsPrev;
                const isGroupEnd = !isSameSenderAsNext;

                const showDateSeparator = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
                
                return (
                  <React.Fragment key={msg.id || idx}>
                    {showDateSeparator && (
                       <div className="flex justify-center my-6 sticky top-2 z-10">
                          <span className="px-3 py-1 bg-slate-200/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-400 shadow-sm">
                             {new Date(msg.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                       </div>
                    )}
                  
                    <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isGroupStart ? 'mt-2' : 'mt-0.5'}`}>
                      <div className={`group flex items-center gap-2 max-w-[85%] md:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                         <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          
                          {/* Sender Name in Global Chat */}
                          {(isGlobal && !isMe && isGroupStart) && (
                            <div className="flex items-center gap-2 mb-1 ml-1">
                               <span className="text-[10px] font-bold text-slate-400">{msg.senderName || 'Student'}</span>
                               {adminIds.includes(msg.senderId) && (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-[8px] uppercase tracking-wider font-bold flex items-center gap-0.5">
                                     <ShieldCheck className="w-2.5 h-2.5" /> Admin
                                  </span>
                               )}
                            </div>
                          )}

                          {/* Attachment Bubble */}
                          {msg.attachment && (
                            <div className={`mb-1 rounded-2xl overflow-hidden border shadow-sm cursor-pointer transition-transform hover:scale-[1.02] ${
                                isMe ? 'rounded-br-sm' : 'rounded-bl-sm'
                            } ${isBlocked ? 'opacity-50 grayscale' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`} 
                            onClick={() => msg.attachment?.type === 'image' && setLightboxImg(msg.attachment.url)}>
                                {msg.attachment.type === 'image' ? (
                                  <img 
                                     src={msg.attachment.url} 
                                     className="max-w-full max-h-60 object-cover" 
                                     onLoad={() => scrollToBottom()} 
                                  />
                                ) : (
                                  <div className="p-4 bg-white dark:bg-slate-800 flex items-center gap-3 min-w-[200px]">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                                        <File className="w-6 h-6 text-brand-violet" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Attachment</p>
                                        <p className="text-[10px] text-slate-400">Click to view</p>
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                          
                          {/* Text Bubble */}
                          {msg.text && (
                            <div className={`px-4 py-2 text-sm font-medium leading-relaxed shadow-sm relative break-words 
                              ${isMe 
                                ? `bg-brand-violet text-white rounded-2xl rounded-tr-sm ${isGroupEnd ? 'rounded-br-xl' : 'rounded-br-sm'}`
                                : `bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800 rounded-2xl rounded-tl-sm ${isGroupEnd ? 'rounded-bl-xl' : 'rounded-bl-sm'}`
                              }
                            `}>
                              {msg.text}
                            </div>
                          )}
                          
                          {/* Status/Time Footer - Improved Indicators */}
                          <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[9px] font-bold text-slate-400 opacity-70">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              
                              {isMe && !isGlobal && (
                                  <span className="ml-0.5">
                                      {msg.status === 'read' ? (
                                          <CheckCheck className="w-3 h-3 text-blue-500" /> 
                                      ) : (
                                          <Check className="w-3 h-3 text-slate-400" />
                                      )}
                                  </span>
                              )}
                          </div>
                        </div>

                        {isAdmin && (
                            <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                               <button 
                                  onClick={() => handlePinMessage(msg.id)}
                                  className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
                                  title="Pin Message"
                               >
                                  <Pin className="w-3.5 h-3.5" />
                               </button>
                               <button 
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-rose-600 transition-colors"
                                  title="Delete Message"
                               >
                                  <Trash2 className="w-3.5 h-3.5" />
                               </button>
                            </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              
              <div ref={messagesEndRef} />
              
              {showScrollButton && (
                  <button 
                    onClick={scrollToBottom}
                    className="fixed bottom-24 right-6 md:absolute md:bottom-6 md:right-6 p-2 bg-slate-900/80 dark:bg-white/90 text-white dark:text-slate-900 rounded-full shadow-xl hover:scale-110 transition-transform z-20 backdrop-blur-md animate-in slide-in-from-bottom-2"
                  >
                     <ChevronDown className="w-5 h-5" />
                  </button>
              )}
            </div>

            {/* Input Area */}
            {theyBlockedMe ? (
              <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-center shrink-0">
                 <p className="text-xs font-bold text-slate-400">You cannot reply to this conversation.</p>
              </div>
            ) : (
              <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
                  <form onSubmit={(e) => handleSendMessage(e)} className="flex items-end gap-3 max-w-4xl mx-auto">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-brand-violet transition-colors rounded-full hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    
                    <div className="flex-1 bg-slate-50 dark:bg-slate-950 rounded-2xl flex items-center border border-transparent focus-within:border-brand-violet/30 focus-within:ring-4 focus-within:ring-brand-violet/10 transition-all">
                       <textarea
                        value={newMessage}
                        onChange={handleTyping}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(e)}
                        placeholder={iBlockedThem ? "Unblock to send message..." : "Type a message..."}
                        disabled={iBlockedThem}
                        className="w-full max-h-32 px-4 py-3.5 bg-transparent border-none focus:ring-0 outline-none text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                        rows={1}
                      />
                    </div>

                    {iBlockedThem ? (
                        <button 
                            type="button"
                            onClick={() => onBlockChat(selectedChat.id)}
                            className="p-3.5 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-2xl font-bold text-xs"
                        >
                            Unblock
                        </button>
                    ) : (
                        <button 
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="p-3.5 bg-brand-violet text-white rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-violet/30 transform active:scale-95"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    )}
                  </form>
                </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 p-8">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 ring-4 ring-white dark:ring-slate-900 shadow-sm">
              <MessageCircle className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="font-bold text-lg text-slate-400 dark:text-slate-500 mb-1">Your Messages</h3>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-600">Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatView;
