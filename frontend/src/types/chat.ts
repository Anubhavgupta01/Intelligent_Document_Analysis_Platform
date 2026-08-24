export interface Citation {
  page: number;
  quote: string;
  score?: number | null;
}

export interface ResponseMetrics {
  latency_ms: number;
  retrieval_relevance?: number | null;
  faithfulness?: number | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string | Date;
  citations?: Citation[];
  metrics?: ResponseMetrics | null;
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
