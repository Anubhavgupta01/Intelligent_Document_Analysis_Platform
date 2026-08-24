import { useState, useRef, useEffect, useCallback } from 'react';
import ChatBubble from './components/ChatBubble';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import { useAuth } from './contexts/AuthContext';
import type { ChatSession } from './types/chat';
import { getChatsList, saveChatSession, deleteChatSession } from './services/chatStorage';
import { RecentChatsList } from './components/RecentChatsList';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface UploadedDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: Date;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  exiting?: boolean;
}



/* ── SVG Icons (inline, no dependency) ─────────────────────── */
const Icons = {
  plus: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  upload: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
  ),
  send: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
  ),
  sun: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
  ),
  moon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  ),
  file: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  ),
  check: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ),
  x: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  ),
  info: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
  ),
  sidebar: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
  ),
  sparkles: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
  ),
  keyboard: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="8" y1="12" x2="8.01" y2="12"/><line x1="12" y1="12" x2="12.01" y2="12"/><line x1="16" y1="12" x2="16.01" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>
  ),
  document: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  ),
};

/* ══════════════════════════════════════════════════════════
   App Component
   ══════════════════════════════════════════════════════════ */
function App() {
  /* ── Auth ─────────────────────────────────────────────────── */
  const { user, token, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [authPage, setAuthPage] = useState<'login' | 'register'>('login');

  /* ── Existing state (unchanged) ──────────────────────────── */
  const [darkMode, setDarkMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [mode, setMode] = useState<'qa' | 'summarize'>('qa');

  /* ── Chat session state ──────────────────────────────────── */
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── New UI‑only state ───────────────────────────────────── */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* ── Toast helpers ───────────────────────────────────────── */
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  }, []);

  /* ── Session management helpers ─────────────────────────── */
  const loadRecentSessions = useCallback(() => {
    const list = getChatsList(user?.id);
    setRecentSessions(list);
  }, [user?.id]);

  const persistActiveSession = useCallback((
    updatedMessages: Message[],
    targetDocId: string | null = documentId,
    targetMode: 'qa' | 'summarize' = mode,
    targetSessionId: string | null = currentSessionId
  ) => {
    if (updatedMessages.length === 0) return;

    const activeDoc = uploadedDocs.find(d => d.id === targetDocId);
    let title = activeDoc ? activeDoc.name : 'Document Chat';
    if (!activeDoc && updatedMessages.length > 0) {
      const firstUserMsg = updatedMessages.find(m => m.role === 'user');
      if (firstUserMsg) {
        title = firstUserMsg.content.slice(0, 30);
      }
    }

    const modeTitle = targetMode === 'summarize' ? 'Summarize' : 'Q&A Chat';

    let sessionId = targetSessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      setCurrentSessionId(sessionId);
    }

    const sessionToSave: ChatSession = {
      id: sessionId,
      title: title,
      mode: modeTitle,
      documentRef: activeDoc ? {
        id: activeDoc.id,
        name: activeDoc.name,
        type: activeDoc.type,
        size: activeDoc.size,
        uploadDate: activeDoc.uploadDate instanceof Date ? activeDoc.uploadDate.toISOString() : activeDoc.uploadDate
      } : {
        id: targetDocId || 'unknown',
        name: title,
        type: 'application/pdf',
        size: 0,
        uploadDate: new Date().toISOString()
      },
      messages: updatedMessages.map(m => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: user?.id
    };

    saveChatSession(sessionToSave);
    loadRecentSessions();
  }, [documentId, mode, currentSessionId, uploadedDocs, user?.id, loadRecentSessions]);

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    
    // 1. Set mode
    const targetMode = session.mode === 'Summarize' || (session.mode as string) === 'summarize' ? 'summarize' : 'qa';
    setMode(targetMode);
    
    // 2. Set messages
    const formattedMessages: Message[] = session.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }));
    setMessages(formattedMessages);

    // 3. Set document and update uploadedDocs list if missing
    if (session.documentRef) {
      setDocumentId(session.documentRef.id);
      setUploadedDocs(prev => {
        const exists = prev.some(d => d.id === session.documentRef.id);
        if (!exists) {
          const restoredDoc: UploadedDoc = {
            id: session.documentRef.id,
            name: session.documentRef.name,
            type: session.documentRef.type || 'application/pdf',
            size: session.documentRef.size || 0,
            uploadDate: new Date(session.documentRef.uploadDate || Date.now())
          };
          return [restoredDoc, ...prev];
        }
        return prev;
      });
    } else {
      setDocumentId(null);
    }

    setMobileMenuOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    deleteChatSession(id);
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setMessages([]);
      setDocumentId(null);
    }
    loadRecentSessions();
    addToast('Chat session deleted', 'info');
  };

  /* ── Reset chat state on user change (logout / account switch) ── */
  useEffect(() => {
    setMessages([]);
    setUploadedDocs([]);
    setDocumentId(null);
    setCurrentSessionId(null);
    setInput('');
    loadRecentSessions();
  }, [user?.id, loadRecentSessions]);

  /* ── Auto‑scroll (unchanged) ─────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Keyboard shortcuts (unchanged) ──────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* ── Dark mode toggle (unchanged) ────────────────────────── */
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  /* ── Upload handler (same logic, now also triggers toast) ── */
  /* ── Upload handler (same logic, now also triggers toast) ── */
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (typeof errorData?.detail === 'string') {
            errorMsg = errorData.detail;
          } else if (Array.isArray(errorData?.detail) && errorData.detail.length > 0) {
            errorMsg = errorData.detail[0]?.msg || errorMsg;
          } else if (errorData?.message) {
            errorMsg = errorData.message;
          }
        } catch {
          // Response was not JSON
        }
        console.error('Upload failed with status', response.status, errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setDocumentId(data.document_id);

      const newDoc: UploadedDoc = {
        id: data.document_id,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        uploadDate: new Date()
      };
      setUploadedDocs(prev => [newDoc, ...prev]);

      const systemMessage: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Document "${file.name}" uploaded successfully (${data.characters?.toLocaleString() || 'unknown'} characters)`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, systemMessage]);
      addToast(`"${file.name}" uploaded successfully`, 'success');
    } catch (error) {
      console.error('Upload handler caught error:', error);
      const rawMsg = error instanceof Error ? error.message : 'Unknown error';
      const displayError = rawMsg.toLowerCase().includes('upload failed') ? rawMsg : `Upload failed: ${rawMsg}`;
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: displayError,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      addToast(displayError, 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploading(false);
    }
  };

  /* ── Send message ─────────────────────────────────────────── */
  const sendMessage = async (customInput?: string) => {
    const textToSend = customInput !== undefined ? customInput : input;
    if (!textToSend.trim() && !(mode === 'summarize' && documentId)) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend.trim() || 'Summarize document',
      timestamp: new Date()
    };

    const currentMessagesWithUser = [...messages, userMessage];
    setMessages(currentMessagesWithUser);
    setInput('');
    setLoading(true);

    try {
      if (mode === 'summarize') {
        const formData = new FormData();
        if (documentId) {
          formData.append('document_id', documentId);
        } else {
          formData.append('text', userMessage.content);
        }

        const response = await fetch(`${API_URL}/summarize`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMsg = errorData?.detail || `Summarization failed (${response.status})`;
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.summary || 'No summary available',
          timestamp: new Date()
        };
        const updatedMessages = [...currentMessagesWithUser, assistantMessage];
        setMessages(updatedMessages);
        persistActiveSession(updatedMessages);
      } else {
        const chatHistory = currentMessagesWithUser
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
            role: msg.role,
            content: msg.content
          }));

        const chatRequest = {
          message: userMessage.content,
          document_id: documentId,
          history: chatHistory
        };

        const response = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(chatRequest),
        });

        if (!response.ok) {
          let errorMsg = `Chat request failed (${response.status})`;
          try {
            const errorData = await response.json();
            if (typeof errorData?.detail === 'string') {
              errorMsg = errorData.detail;
            } else if (Array.isArray(errorData?.detail) && errorData.detail.length > 0) {
              errorMsg = errorData.detail[0]?.msg || errorMsg;
            }
          } catch {}
          console.error('Chat endpoint error:', response.status, errorMsg);
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.response || 'No response available',
          timestamp: new Date()
        };
        const updatedMessages = [...currentMessagesWithUser, assistantMessage];
        setMessages(updatedMessages);
        persistActiveSession(updatedMessages);
      }
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Send message error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error: ${rawMsg}`,
        timestamp: new Date()
      };
      const updatedMessages = [...currentMessagesWithUser, errorMessage];
      setMessages(updatedMessages);
      persistActiveSession(updatedMessages);
      addToast(`Error: ${rawMsg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ── Helpers ─────────────────────────────────────────────── */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string): string => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('text')) return '📃';
    if (type.includes('image')) return '🖼️';
    return '📁';
  };

  const newChat = () => {
    if (messages.length > 0) {
      persistActiveSession(messages);
    }
    setMessages([]);
    setDocumentId(null);
    setUploadedDocs([]);
    setCurrentSessionId(null);
    setInput('');
    setMode('qa');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    loadRecentSessions();
  };

  /* ── Drag‑and‑drop on file area ──────────────────────────── */
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  /* ══════════════════════════════════════════════════════════
     AUTH GATE
     ══════════════════════════════════════════════════════════ */
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4 animate-fadeIn">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authPage === 'register') {
      return <RegisterPage onSwitchToLogin={() => setAuthPage('login')} />;
    }
    return <LoginPage onSwitchToRegister={() => setAuthPage('register')} />;
  }

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <div className={`h-screen flex overflow-hidden ${darkMode ? 'dark' : ''}`}>

      {/* ── Mobile overlay backdrop ──────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════
          LEFT SIDEBAR
          ═══════════════════════════════════════════════════════ */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-72 lg:w-[280px]
        bg-gray-50 dark:bg-gray-900
        border-r border-gray-200/80 dark:border-gray-700/60
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand + New Chat */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              {Icons.sparkles}
            </div>
            <span className="font-semibold text-sm text-gray-900 dark:text-white tracking-tight">IDAP</span>
          </div>

          <button
            onClick={() => { newChat(); setMobileMenuOpen(false); }}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98]"
          >
            {Icons.plus}
            New Chat
          </button>
        </div>

        {/* Mode Selection */}
        <div className="px-5 pb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            Mode
          </label>
          <div className="flex gap-1.5 p-1 bg-gray-200/60 dark:bg-gray-800 rounded-xl">
            <button
              onClick={() => setMode('qa')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                mode === 'qa'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              💬 Q&A Chat
            </button>
            <button
              onClick={() => setMode('summarize')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                mode === 'summarize'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              📝 Summarize
            </button>
          </div>
        </div>

        {/* File Upload Zone */}
        <div className="px-5 pb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
            Upload Document
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer
              transition-all duration-200
              ${dragOver
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
              }
              ${uploading ? 'opacity-60 pointer-events-none' : ''}
            `}
          >
            <div className={`text-gray-400 dark:text-gray-500 ${dragOver ? 'text-blue-500' : ''}`}>
              {Icons.upload}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {uploading ? 'Uploading…' : 'Drag & drop or click to browse'}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">PDF, DOCX, TXT</p>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              className="hidden"
              disabled={uploading}
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/50 dark:bg-gray-900/50">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Uploaded Documents */}
        <div className="flex-1 overflow-auto px-5 space-y-4">
          <div>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-gray-400 dark:text-gray-500">{Icons.file}</span>
              Documents
              {uploadedDocs.length > 0 && (
                <span className="ml-auto bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {uploadedDocs.length}
                </span>
              )}
            </h3>

            {uploadedDocs.length === 0 ? (
              <div className="text-center py-4 animate-fade-in">
                <div className="text-gray-300 dark:text-gray-600 mb-1 scale-90">
                  {Icons.document}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uploadedDocs.map((doc, i) => (
                  <div
                    key={doc.id}
                    onClick={() => setDocumentId(doc.id)}
                    className={`
                      p-3 rounded-xl border cursor-pointer card-hover
                      transition-all duration-200 animate-slide-up
                      ${documentId === doc.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-400/30'
                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600'
                      }
                    `}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg flex-shrink-0">
                        {getFileIcon(doc.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {doc.name}
                        </div>
                        <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1.5">
                          <span>{formatFileSize(doc.size)}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                          <span>{doc.uploadDate.toLocaleDateString()}</span>
                        </div>
                      </div>
                      {documentId === doc.id && (
                        <div className="text-blue-500 flex-shrink-0 mt-0.5">{Icons.check}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Chats Section in Left Sidebar */}
          <div className="pt-3 border-t border-gray-200/60 dark:border-gray-700/50">
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="text-blue-500">{Icons.sparkles}</span>
                Recent Chats
              </span>
              {recentSessions.length > 0 && (
                <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {recentSessions.length}
                </span>
              )}
            </h3>
            <RecentChatsList
              sessions={recentSessions}
              activeSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          CENTER CHAT AREA
          ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 min-w-0">
        {/* Header */}
        <div className="border-b border-gray-200/80 dark:border-gray-700/60 px-4 lg:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            >
              {Icons.sidebar}
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
              Intelligent Document Analysis Platform
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              {mode === 'qa' ? 'Q&A Mode' : 'Summarize Mode'}
            </div>
            {/* User info */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                  {user.full_name}
                </span>
              </div>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-all duration-200 hover:scale-105 active:scale-95"
              title="Toggle dark mode"
            >
              {darkMode ? Icons.sun : Icons.moon}
            </button>
            {/* Logout button */}
            <button
              onClick={logout}
              className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 hover:scale-105 active:scale-95"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-auto px-4 lg:px-6 py-6">
          {messages.length === 0 ? (
            /* ── Empty state ──────────────────────────────────── */
            <div className="flex items-center justify-center h-full animate-fade-in">
              <div className="text-center max-w-md">
                <div className="relative mx-auto w-20 h-20 mb-6">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/20 rotate-6" />
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-50 to-white dark:from-gray-800 dark:to-gray-700 flex items-center justify-center shadow-lg">
                    <span className="text-3xl animate-bounce-gentle">🤖</span>
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 tracking-tight">
                  How can I help you today?
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                  Upload a document and ask questions, or paste text to summarize. I'm powered by Meta LLaMA 3.1.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {[
                    { key: 'Enter', label: 'Send' },
                    { key: 'Shift+Enter', label: 'New line' },
                    { key: 'Ctrl+K', label: 'Focus' },
                  ].map(shortcut => (
                    <div key={shortcut.key} className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                      <kbd className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono text-[10px] border border-gray-200 dark:border-gray-600 shadow-sm">
                        {shortcut.key}
                      </kbd>
                      <span>{shortcut.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Message list ─────────────────────────────────── */
            <div className="max-w-3xl mx-auto">
              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}

              {/* Skeleton loading */}
              {loading && (
                <div className="flex justify-start mb-6 animate-fade-in">
                  <div className="flex gap-3 max-w-[75%]">
                    <div className="relative flex-shrink-0">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                        AI
                      </div>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 animate-pulse-ring" />
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700/80 rounded-2xl rounded-bl-md px-5 py-4 shadow-sm space-y-2.5 min-w-[180px]">
                      <div className="skeleton h-3 w-[85%] rounded-full" />
                      <div className="skeleton h-3 w-[65%] rounded-full" />
                      <div className="skeleton h-3 w-[45%] rounded-full" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200/80 dark:border-gray-700/60 p-4 lg:px-6">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={
                  mode === 'qa'
                    ? documentId
                      ? 'Ask a question about your document...'
                      : 'Ask a question or upload a document first...'
                    : documentId
                    ? 'Click Send to summarize the uploaded document, or type text to summarize...'
                    : 'Paste text to summarize or upload a document...'
                }
                className="w-full p-4 pr-12 border border-gray-200 dark:border-gray-600 rounded-xl resize-none bg-gray-50 dark:bg-gray-700/60 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm leading-relaxed
                  focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500
                  transition-all duration-200 shadow-sm focus:shadow-md"
                rows={Math.min(Math.max(input.split('\n').length, 1), 4)}
                disabled={loading}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && (mode === 'qa' || !documentId))}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-600 dark:disabled:to-gray-700 text-white px-5 py-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.97]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline">Thinking…</span>
                </>
              ) : (
                <>
                  {Icons.send}
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          RIGHT INSIGHTS PANEL
          ═══════════════════════════════════════════════════════ */}
      <div className="hidden xl:flex w-[300px] bg-gray-50 dark:bg-gray-900 border-l border-gray-200/80 dark:border-gray-700/60 flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-200/80 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="text-blue-500">{Icons.sparkles}</span>
            Insights
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Quick actions for your document
          </p>
        </div>

        <div className="flex-1 p-5 space-y-3 overflow-auto">
          {!documentId ? (
            /* ── Empty insights state ─────────────────────────── */
            <div className="text-center py-10 animate-fade-in">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <span className="text-3xl animate-bounce-gentle">📄</span>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                No document selected
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 max-w-[200px] mx-auto leading-relaxed">
                Upload a document to unlock AI-powered insights and analysis
              </p>
            </div>
          ) : (
            <>
              {/* Insight action cards */}
              {[
                { label: 'Summarize Document', desc: 'Generate a concise summary', icon: '📝', accent: 'border-l-blue-400', action: () => { setMode('summarize'); sendMessage(''); } },
                { label: 'Extract Key Points', desc: 'Identify main points and insights', icon: '🔑', accent: 'border-l-amber-400', action: () => { setMode('summarize'); sendMessage('Extract the key points from this document'); } },
                { label: 'Generate Tasks', desc: 'Create actionable items', icon: '✅', accent: 'border-l-green-400', action: () => { setMode('summarize'); sendMessage('Generate actionable tasks from this document'); } },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  disabled={loading}
                  className={`w-full p-4 text-left bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 border-l-[3px] ${item.accent} rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed card-hover group`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-xl group-hover:scale-110 transition-transform duration-200">{item.icon}</div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Stats cards */}
          <div className="mt-6 space-y-3">
            <div className="glass rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/30">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                Document Stats
              </h4>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${documentId ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {documentId ? 'Document loaded' : 'No document selected'}
                </span>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/30">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider flex items-center justify-between">
                <span>Recent Chats</span>
                {recentSessions.length > 0 && (
                  <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {recentSessions.length}
                  </span>
                )}
              </h4>
              <RecentChatsList
                sessions={recentSessions}
                activeSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
              />
            </div>
          </div>
        </div>

        {/* Footer tip */}
        <div className="p-5 border-t border-gray-200/80 dark:border-gray-700/60">
          <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2 group">
            <span className="group-hover:rotate-12 transition-transform duration-300">{Icons.keyboard}</span>
            <span>Tip: Use keyboard shortcuts to navigate faster</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TOAST NOTIFICATIONS
          ═══════════════════════════════════════════════════════ */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto max-w-sm px-4 py-3 rounded-xl shadow-xl border backdrop-blur-sm
              flex items-start gap-3
              ${toast.exiting ? 'toast-exit' : 'toast-enter'}
              ${toast.type === 'success'
                ? 'bg-green-50/90 dark:bg-green-900/80 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                : toast.type === 'error'
                ? 'bg-red-50/90 dark:bg-red-900/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : 'bg-white/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
              }
            `}
          >
            <span className="mt-0.5 flex-shrink-0">
              {toast.type === 'success' ? Icons.check : toast.type === 'error' ? Icons.x : Icons.info}
            </span>
            <p className="text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              {Icons.x}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
