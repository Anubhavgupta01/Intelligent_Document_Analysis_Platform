import type { ChatSession, DocumentRef } from '../types/chat';

export interface ServerDocument {
  id: string;
  name: string;
  file_type: string;
  size: number;
  characters: number;
  created_at: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  return fallback;
}

export async function getServerSessions(apiUrl: string, token: string): Promise<ChatSession[]> {
  const response = await fetch(`${apiUrl}/sessions`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(await parseError(response, 'Could not load saved chats.'));
  const data = await response.json();
  return data.sessions || [];
}

export async function saveServerSession(apiUrl: string, token: string, session: ChatSession): Promise<void> {
  const response = await fetch(`${apiUrl}/sessions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(session),
  });
  if (!response.ok) throw new Error(await parseError(response, 'Could not save this chat.'));
}

export async function deleteServerSession(apiUrl: string, token: string, sessionId: string): Promise<void> {
  const response = await fetch(`${apiUrl}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await parseError(response, 'Could not delete this chat.'));
}

export async function getServerDocuments(apiUrl: string, token: string): Promise<ServerDocument[]> {
  const response = await fetch(`${apiUrl}/documents`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(await parseError(response, 'Could not load saved documents.'));
  const data = await response.json();
  return data.documents || [];
}

export function toDocumentRef(document: ServerDocument): DocumentRef {
  return {
    id: document.id,
    name: document.name,
    type: document.file_type || 'application/octet-stream',
    size: document.size || 0,
    uploadDate: document.created_at,
  };
}
