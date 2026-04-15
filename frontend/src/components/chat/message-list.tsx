import { useEffect, useRef } from 'react';
import type { Message } from '../../types/chat';
import { MessageBubble } from './message-bubble';

interface Props {
  messages: Message[];
  onRegenerate?: () => void;
  isLoadingMessages?: boolean;
}

export function MessageList({ messages, onRegenerate, isLoadingMessages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoadingMessages) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 select-none">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading messages…
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 select-none">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-400">How can I help you today?</p>
        <p className="text-xs mt-1 text-slate-600">Type a message or attach an image to get started</p>
      </div>
    );
  }

  const lastAssistantIdx = messages.reduce(
    (last, m, i) => (m.role === 'assistant' ? i : last), -1
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isLast={i === lastAssistantIdx}
          onRegenerate={i === lastAssistantIdx ? onRegenerate : undefined}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
