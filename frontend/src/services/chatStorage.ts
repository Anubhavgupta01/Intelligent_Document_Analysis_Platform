import type { ChatSession } from '../types/chat';

const CHATS_INDEX_KEY = 'chats:list';
const CHAT_KEY_PREFIX = 'chats:';

export const getChatsList = (userId?: string): ChatSession[] => {
  try {
    const rawIndex = localStorage.getItem(CHATS_INDEX_KEY);
    if (!rawIndex) return [];
    const sessions: ChatSession[] = JSON.parse(rawIndex);
    
    // Sort by updatedAt descending
    const sorted = sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    if (userId) {
      return sorted.filter(s => !s.userId || s.userId === userId);
    }
    return sorted;
  } catch (err) {
    console.error('Failed to parse chats:list from localStorage', err);
    return [];
  }
};

export const getChatSession = (id: string): ChatSession | null => {
  try {
    const raw = localStorage.getItem(`${CHAT_KEY_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to get chat session ${id}`, err);
    return null;
  }
};

export const saveChatSession = (session: ChatSession): void => {
  try {
    const sessionKey = `${CHAT_KEY_PREFIX}${session.id}`;
    localStorage.setItem(sessionKey, JSON.stringify(session));

    // Update index `chats:list`
    const rawIndex = localStorage.getItem(CHATS_INDEX_KEY);
    let currentList: ChatSession[] = rawIndex ? JSON.parse(rawIndex) : [];
    
    const existingIndex = currentList.findIndex(s => s.id === session.id);
    if (existingIndex >= 0) {
      currentList[existingIndex] = session;
    } else {
      currentList.unshift(session);
    }

    // Sort by updatedAt descending
    currentList.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    localStorage.setItem(CHATS_INDEX_KEY, JSON.stringify(currentList));
  } catch (err) {
    console.error(`Failed to save chat session ${session.id}`, err);
  }
};

export const deleteChatSession = (id: string): void => {
  try {
    localStorage.removeItem(`${CHAT_KEY_PREFIX}${id}`);

    const rawIndex = localStorage.getItem(CHATS_INDEX_KEY);
    if (rawIndex) {
      const currentList: ChatSession[] = JSON.parse(rawIndex);
      const updatedList = currentList.filter(s => s.id !== id);
      localStorage.setItem(CHATS_INDEX_KEY, JSON.stringify(updatedList));
    }
  } catch (err) {
    console.error(`Failed to delete chat session ${id}`, err);
  }
};

export const formatRelativeTime = (dateInput: string | Date): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
