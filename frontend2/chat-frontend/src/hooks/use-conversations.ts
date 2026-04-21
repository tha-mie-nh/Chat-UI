import { useState, useCallback, useEffect, useRef } from 'react';
import type { Conversation, Message } from '../types/chat';
import { apiClient } from '../lib/api-client';

// [ROLLBACK] localStorage-based activeId — replaced by URL params routing
// const ACTIVE_ID_KEY = 'chatui_active_conversation_id';

/**
 * Manages conversation list and lazy message loading.
 * activeId is now owned by the URL (/:conversationId) — passed in from the route component.
 */
export function useConversations(activeId: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Ref-based cache check to avoid stale closures in effects
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;

  // Load conversation list on mount
  useEffect(() => {
    apiClient.listConversations()
      .then((list) => setConversations(list.map((c) => ({ ...c, messages: [] }))))
      .catch(console.error);
  }, []);

  // Lazy-load messages whenever activeId changes (URL navigation)
  useEffect(() => {
    if (!activeId) return;

    const existing = conversationsRef.current.find((c) => c.id === activeId);
    if (existing && existing.messages.length > 0) return; // already cached

    setIsLoadingMessages(true);
    apiClient.getConversation(activeId)
      .then((full) => {
        setConversations((prev) =>
          prev.map((c) => c.id === activeId ? { ...c, messages: full.messages, title: full.title } : c)
        );
      })
      .catch(console.error)
      .finally(() => setIsLoadingMessages(false));
  }, [activeId]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  /** Create a new conversation — caller is responsible for navigating to the new id */
  const createConversation = useCallback(async (): Promise<string> => {
    const created = await apiClient.createConversation();
    const conv: Conversation = { ...created, messages: [] };
    setConversations((prev) => [conv, ...prev]);
    return conv.id;
  }, []);

  /** Update in-memory messages for a conversation (called by useChat on each change) */
  const updateMessages = useCallback((id: string, messages: Message[]) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, messages, updatedAt: Date.now() } : c))
    );
  }, []);

  /** Delete a conversation — caller is responsible for navigating away if it was active */
  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    await apiClient.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  /** Update conversation title in sidebar (called when backend sets title after first message) */
  const refreshConversationTitle = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  return {
    conversations,
    activeConversation,
    isLoadingMessages,
    createConversation,
    updateMessages,
    deleteConversation,
    refreshConversationTitle,
  };
}
