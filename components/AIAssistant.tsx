import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Loader2, Settings, Trash2, ChevronDown } from 'lucide-react';
import { User } from '../types';
import { auth } from '../services/firebase';

interface AIAssistantProps {
  user: User;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export default function AIAssistant({ user }: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Assistant Configuration
  const [model, setModel] = useState('gemini-3.7-flash');
  const [systemInstruction, setSystemInstruction] = useState('You are a helpful assistant for the RETRIVA lost and found application.');
  const [showConfig, setShowConfig] = useState(false);

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
          history: messages,
          model: model,
          systemInstruction: systemInstruction
        })
      });

      if (!response.ok) throw new Error('Failed to get response from AI');
      
      const data = await response.json();
      
      if (data.history) {
          // If the backend returns full history, use it. But we just append the model's response for safety.
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
    <div className="flex flex-col h-full bg-off-white dark:bg-slate-950 max-w-4xl mx-auto w-full border-x border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      
      {/* Header */}
      <div className="flex-none p-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-violet/10 text-brand-violet rounded-lg">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Gemini Assistant</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Powered by @google/genai</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-lg transition-colors ${showConfig ? 'bg-brand-violet/10 text-brand-violet' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Configure Assistant"
          >
            <Settings size={20} />
          </button>
          <button 
            onClick={clearChat}
            className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-lg transition-colors"
            title="Clear Chat"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="flex-none p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 animate-slide-up">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Model Selection
              </label>
              <div className="relative">
                <select 
                  value={model} 
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-brand-violet"
                >
                  <option value="gemini-3.7-flash">Gemini 3.5 Flash (General Tasks)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Complex Tasks)</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fast Tasks)</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                System Instruction (Role)
              </label>
              <textarea 
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                rows={2}
                placeholder="Give the assistant a specific persona or behavior rule..."
                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-violet resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 opacity-50">
            <Bot size={48} className="mb-4 text-slate-400" />
            <h3 className="text-xl font-medium mb-2">How can I help you today?</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Ask me to draft a lost item report, suggest matching items, or configure my persona using the settings above.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-brand-violet text-white'}`}>
                {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
              </div>
              <div 
                className={`max-w-[80%] rounded-2xl p-4 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-tl-none'
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
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-violet text-white flex items-center justify-center">
              <Bot size={16} />
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-brand-violet" />
              <span className="text-sm text-slate-500 font-medium">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="relative flex items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Message Gemini..."
            rows={1}
            className="w-full bg-slate-100 dark:bg-slate-800 border-0 rounded-2xl py-3 pl-4 pr-12 focus:ring-2 focus:ring-brand-violet/50 resize-none max-h-32 overflow-y-auto"
            style={{ minHeight: '52px' }}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-brand-violet hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-brand-violet text-white rounded-xl transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="text-center mt-2">
           <span className="text-[10px] text-slate-400">Gemini can make mistakes. Verify important information.</span>
        </div>
      </div>
    </div>
  );
}
