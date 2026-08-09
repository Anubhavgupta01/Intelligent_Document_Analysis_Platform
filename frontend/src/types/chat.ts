export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string | Date;
}

export interface DocumentRef {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: string | Date;
}

export type ChatMode = 'Q&A Chat' | 'Summarize';

export interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;
  documentRef: DocumentRef;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
}
