import React from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Simple markdown rendering
  const renderContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-md text-xs font-mono">$1</code>')
      .replace(/\n/g, '<br>');
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-5 animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 backdrop-blur-sm rounded-full px-5 py-2 text-amber-700 dark:text-amber-300 text-xs font-medium shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex mb-6 animate-slide-up ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        {/* Avatar */}
        <div className="flex-shrink-0 relative">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md ${
            isUser
              ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20'
              : 'bg-gradient-to-br from-gray-500 to-gray-600 shadow-gray-500/20'
          }`}>
            {isUser ? 'U' : 'AI'}
          </div>
          {!isUser && (
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 opacity-0 group-hover:opacity-30 animate-pulse-ring pointer-events-none" />
          )}
        </div>

        {/* Message bubble */}
        <div className={`rounded-2xl px-4 py-3 shadow-sm group ${
          isUser
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md shadow-blue-500/15'
            : 'bg-gray-100 dark:bg-gray-700/80 text-gray-900 dark:text-gray-100 rounded-bl-md backdrop-blur-sm'
        }`}>
          <div
            className="prose prose-sm max-w-none dark:prose-invert leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderContent(message.content) }}
          />
          <div className={`text-[10px] mt-2 transition-opacity duration-200 ${
            isUser
              ? 'text-blue-100/70 group-hover:text-blue-100'
              : 'text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100'
          }`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;