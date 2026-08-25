import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import { User } from '../types';
import { auth } from '../services/firebase';

interface AIAssistantProps {
  user: User;
  onBack: () => void;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export default function AIAssistant({ user, onBack }: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', parts: [{ text: input.trim() }] };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const userObj = auth.currentUser;
      const token = userObj ? await userObj.getIdToken() : '';

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage.parts[0].text,
          history: messages
        })
      });

      if (!response.ok) throw new Error('Failed to get response from AI');
      
      const data = await response.json();
      
      if (data.history) {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.result }] }]);
      } else {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.result }] }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: '*Sorry, I encountered an error. Please try again.*' }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('Are you sure you want to clear the conversation history?')) {
      setMessages([]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-off-white dark:bg-slate-950 max-w-4xl mx-auto w-full border-x border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fade-in">
      
      {/* Header */}
      <div className="flex-none p-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 mr-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Back to Dashboard">
            <ArrowLeft size={20} />
          </button>
          <div className="p-2 bg-brand-violet/10 text-brand-violet rounded-lg shadow-sm">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Retriva AI Assistant</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Powered by Gemini</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={clearChat}
            className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors"
            title="Clear Chat"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 opacity-70">
            <div className="relative">
              <Bot size={48} className="mb-4 text-brand-violet relative z-10" />
              <div className="absolute inset-0 bg-brand-violet/20 blur-xl rounded-full animate-pulse-soft"></div>
            </div>
            <h3 className="text-xl font-medium mb-2 text-slate-900 dark:text-white">How can I help you today?</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Ask me to draft a lost item report, suggest matching items, or help you navigate the Retriva platform.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-slide-up`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-brand-violet text-white shadow-md'}`}>
                {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
              </div>
              <div 
                className={`max-w-[80%] rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-brand-violet text-white rounded-tr-none shadow-sm' 
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-tl-none text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="prose dark:prose-invert prose-sm max-w-none whitespace-pre-wrap leading-relaxed">
                  {msg.parts[0].text}
                </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-violet text-white flex items-center justify-center shadow-md">
              <Bot size={16} />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-brand-violet" />
              <span className="text-sm text-slate-500 font-medium">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="relative flex items-center shadow-sm rounded-2xl">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Message Retriva AI..."
            rows={1}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl py-3 pl-4 pr-12 focus:ring-2 focus:ring-brand-violet/50 resize-none max-h-32 overflow-y-auto"
            style={{ minHeight: '52px' }}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-brand-violet hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-brand-violet text-white rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="text-center mt-2">
           <span className="text-[10px] text-slate-400">I am an AI assistant and may make mistakes. Please verify important information.</span>
        </div>
      </div>
    </div>
  );
}
