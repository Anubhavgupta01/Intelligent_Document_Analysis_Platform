import React from 'react';
import type { Message } from '../types/chat';

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const renderContent = (content: string) => content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-md text-xs font-mono">$1</code>')
    .replace(/\n/g, '<br>');

  if (isSystem) {
    return (
      <div className="my-5 flex justify-center animate-fade-in">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/60 bg-amber-50/80 px-5 py-2 text-xs font-medium text-amber-700 shadow-sm backdrop-blur-sm dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-6 flex animate-slide-up ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[78%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        <div className="relative shrink-0">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white shadow-md ${isUser ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20' : 'bg-gradient-to-br from-gray-500 to-gray-600 shadow-gray-500/20'}`}>
            {isUser ? 'U' : 'AI'}
          </div>
        </div>

        <div className={`group rounded-2xl px-4 py-3 shadow-sm ${isUser ? 'rounded-br-md bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/15' : 'rounded-bl-md bg-gray-100 text-gray-900 backdrop-blur-sm dark:bg-gray-700/80 dark:text-gray-100'}`}>
          <div className="prose prose-sm max-w-none leading-relaxed dark:prose-invert" dangerouslySetInnerHTML={{ __html: renderContent(message.content) }} />

          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="mt-4 border-t border-gray-200/80 pt-3 dark:border-gray-600/70">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg>
                Sources
              </div>
              <div className="space-y-2">
                {message.citations.map((citation, index) => (
                  <div key={`${citation.page}-${index}`} className="rounded-lg bg-white/70 px-2.5 py-2 text-[11px] leading-4 text-gray-600 dark:bg-gray-800/50 dark:text-gray-300">
                    <div className="mb-0.5 font-semibold text-blue-600 dark:text-blue-300">Page {citation.page}{citation.score != null ? ` · ${(citation.score * 100).toFixed(0)}% match` : ''}</div>
                    <p>“{citation.quote}”</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isUser && message.metrics && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400 dark:text-gray-500" title="Faithfulness and relevance are heuristic estimates, not guarantees.">
              {message.metrics.latency_ms != null && <span>{Math.round(message.metrics.latency_ms)} ms</span>}
              {message.metrics.retrieval_relevance != null && <span>Retrieval {(message.metrics.retrieval_relevance * 100).toFixed(0)}%</span>}
              {message.metrics.faithfulness != null && <span>Evidence overlap {(message.metrics.faithfulness * 100).toFixed(0)}%</span>}
            </div>
          )}

          <div className={`mt-2 text-[10px] transition-opacity duration-200 ${isUser ? 'text-blue-100/70 group-hover:text-blue-100' : 'text-gray-400 opacity-0 group-hover:opacity-100 dark:text-gray-500'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
