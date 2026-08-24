import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { RootState } from '../store/store';
import { chatApi } from '../api';
import { Message } from '../types';
import clsx from 'clsx';

const ChatArea = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const activeDocumentId = useSelector((state: RootState) => state.document.activeDocumentId);
  const documents = useSelector((state: RootState) => state.document.documents);

  const activeDocName = activeDocumentId 
    ? documents.find(d => d.id === activeDocumentId)?.filename 
    : 'All Documents';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await chatApi.sendMessage(userMsg.content, activeDocumentId);
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.data.answer,
        createdAt: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-white dark:bg-gray-950">
      <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 flex-shrink-0">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Chat</h2>
          <p className="text-sm text-gray-500">Searching Context: <span className="text-primary font-medium">{activeDocName}</span></p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Bot className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-700" />
            <p className="text-lg">Ask me anything about your documents!</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={clsx("flex space-x-4", msg.role === 'user' ? "flex-row-reverse space-x-reverse" : "")}>
            <div className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
              msg.role === 'user' ? "bg-primary text-white" : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            )}>
              {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            <div className={clsx(
              "max-w-2xl px-5 py-3 rounded-2xl shadow-sm leading-relaxed text-[15px]",
              msg.role === 'user' 
                ? "bg-primary text-white rounded-tr-none" 
                : "bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-200 dark:border-gray-800"
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex space-x-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <Bot className="w-5 h-5" />
            </div>
            <div className="px-5 py-4 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-tl-none">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask a question about ${activeDocName}...`}
            className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="absolute right-2 p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatArea;
