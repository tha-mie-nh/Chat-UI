import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { ChatHeader } from './chat-header';
import { MessageList } from './message-list';
import { ChatInput } from './chat-input';
import { SettingsPanel } from '../settings/settings-panel';
import { ConversationSidebar } from '../sidebar/conversation-sidebar';
import { useChat } from '../../hooks/use-chat';
import { useConfig } from '../../hooks/use-config';
import { useConversations } from '../../hooks/use-conversations';
import type { Message } from '../../types/chat';

export function ChatWindow() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const activeId = conversationId ?? null;

  const { config, updateConfig } = useConfig();
  const {
    conversations,
    activeConversation,
    isLoadingMessages,
    createConversation,
    updateMessages,
    deleteConversation,
    refreshConversationTitle,
  } = useConversations(activeId);

  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  // [ROLLBACK] attachedImages was managed here — now owned by ChatInput via useImageUploader
  // const [attachedImages, setAttachedImages] = useState<string[]>([]);
  // null = still loading list; false = list loaded, id not found
  const [convNotFound, setConvNotFound] = useState<boolean | null>(null);

  // Once conversation list loads, verify the activeId exists
  useEffect(() => {
    if (conversations.length === 0) return; // not loaded yet
    const exists = conversations.some((c) => c.id === activeId);
    setConvNotFound(!exists);
  }, [conversations, activeId]);

  const handleMessagesChange = useCallback(
    (msgs: Message[]) => {
      if (activeId) updateMessages(activeId, msgs);
    },
    [activeId, updateMessages]
  );

  const handleConversationMeta = useCallback(
    ({ title }: { title: string }) => {
      if (activeId) refreshConversationTitle(activeId, title);
    },
    [activeId, refreshConversationTitle]
  );

  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    regenerate,
    clearMessages,
    loadMessages,
  } = useChat(activeId, {
    initialMessages: activeConversation?.messages ?? [],
    onMessagesChange: handleMessagesChange,
    onConversationMeta: handleConversationMeta,
  });

  // Reload messages into useChat when active conversation changes or messages finish loading
  useEffect(() => {
    if (!isStreaming) {
      loadMessages(activeConversation?.messages ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, isLoadingMessages]);

  const handleSend = useCallback(
    async (text: string, images: string[]) => {
      if (!activeId) {
        const newId = await createConversation();
        navigate(`/${newId}`);
      }
      sendMessage(text, images);
    },
    [activeId, createConversation, navigate, sendMessage]
  );

  const handleNewConversation = useCallback(async () => {
    const newId = await createConversation();
    clearMessages();
    setSidebarOpen(false);
    navigate(`/${newId}`);
  }, [createConversation, clearMessages, navigate]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      setSidebarOpen(false);
      navigate(`/${id}`);
    },
    [navigate]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (id === activeId) {
        navigate('/');
      }
    },
    [activeId, deleteConversation, navigate]
  );

  // Redirect to / if conversationId is invalid (after list loads)
  if (convNotFound === true) return <Navigate to="/" replace />;

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <ChatHeader
          model={config.model}
          onOpenSettings={() => setShowSettings(true)}
          onClearChat={clearMessages}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />

        <MessageList
          messages={messages}
          onRegenerate={!isStreaming ? regenerate : undefined}
          isLoadingMessages={isLoadingMessages}
        />

        {error && (
          <div className="mx-4 mb-2 px-4 py-2.5 bg-red-900/40 border border-red-800/60 rounded-lg text-red-300 text-xs flex items-start gap-2 shrink-0">
            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="flex-1 break-all">{error}</span>
          </div>
        )}

        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming}
        />
      </div>

      {showSettings && (
        <SettingsPanel
          config={config}
          onSave={updateConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
