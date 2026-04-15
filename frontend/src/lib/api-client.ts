import type { Conversation, Message } from '../types/chat';
import { apiBase } from './api-base';

// apiBase resolves to VITE_BACKEND_URL/api (if set) or /api (nginx proxy)

/** Backend returns snake_case timestamps — map to Conversation camelCase */
interface BackendConversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  messages?: Message[];
}

function mapConversation(raw: BackendConversation): Omit<Conversation, 'messages'> & { messages: Message[] } {
  return {
    id: raw.id,
    title: raw.title,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    messages: raw.messages ?? [],
  };
}

/** Typed REST client for the demo backend */
export const apiClient = {
  listConversations(): Promise<Omit<Conversation, 'messages'>[]> {
    return fetch(`${apiBase}/conversations`)
      .then((r) => r.json() as Promise<BackendConversation[]>)
      .then((list) => list.map(mapConversation));
  },

  createConversation(): Promise<Omit<Conversation, 'messages'>> {
    return fetch(`${apiBase}/conversations`, { method: 'POST' })
      .then((r) => r.json() as Promise<BackendConversation>)
      .then(mapConversation);
  },

  getConversation(id: string): Promise<Conversation> {
    return fetch(`${apiBase}/conversations/${id}`)
      .then((r) => r.json() as Promise<BackendConversation>)
      .then(mapConversation);
  },

  deleteConversation(id: string): Promise<void> {
    return fetch(`${apiBase}/conversations/${id}`, { method: 'DELETE' }).then(() => undefined);
  },
};
