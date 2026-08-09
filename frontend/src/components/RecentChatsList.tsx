import React, { useState, useEffect, useRef } from 'react';
import type { ChatSession } from '../types/chat';
import { formatRelativeTime } from '../services/chatStorage';

interface RecentChatsListProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
}

export const RecentChatsList: React.FC<RecentChatsListProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-6 px-4 animate-fade-in bg-white/50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700/40">
        <div className="w-10 h-10 mx-auto mb-2.5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          No recent chats yet
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          Upload a file & ask questions to save history
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const isActive = activeSessionId === session.id;
        const isMenuOpen = openMenuId === session.id;

        return (
          <div
            key={session.id}
            onClick={() => onSelectSession(session)}
            className={`
              group relative p-3 rounded-xl border cursor-pointer
              transition-all duration-200 card-hover
              ${isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-400/30'
                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600'
              }
            `}
          >
            <div className="flex items-start justify-between gap-2">
              {/* Document Title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                    {session.title || 'Untitled Document'}
                  </span>
                </div>

                {/* Mode Badge & Timestamp */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {session.mode === 'Summarize' || (session.mode as string) === 'summarize' ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50">
                      Summary
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                      Q&A
                    </span>
                  )}

                  <span className="text-[11px] text-gray-400 dark:text-gray-500">
                    {formatRelativeTime(session.updatedAt)}
                  </span>
                </div>
              </div>

              {/* Action Menu (Three Dots) */}
              <div className="relative" ref={isMenuOpen ? menuRef : null}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(isMenuOpen ? null : session.id);
                  }}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Session options"
                  aria-label="Session options"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="19" cy="12" r="1"></circle>
                    <circle cx="5" cy="12" r="1"></circle>
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div
                    className="absolute right-0 top-6 z-50 w-32 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 text-xs animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        onDeleteSession(session.id);
                      }}
                      className="w-full px-3 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 font-medium transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
