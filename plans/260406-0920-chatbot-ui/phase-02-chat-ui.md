# Phase 2 — Chat UI Components

**Status:** ⬜ Todo  
**Priority:** High

## Overview

Build the core chat UI: message list, message bubbles, input box, header.

## Components

| File | Purpose |
|------|---------|
| `src/components/chat/chat-window.tsx` | Main container, orchestrates chat layout |
| `src/components/chat/message-list.tsx` | Scrollable list of messages |
| `src/components/chat/message-bubble.tsx` | Individual message (user/assistant) with markdown |
| `src/components/chat/chat-input.tsx` | Textarea + send button |
| `src/components/chat/chat-header.tsx` | Title + settings gear icon |
| `src/types/chat.ts` | `Message`, `Role`, `ChatState` types |

## UI Design

- Dark theme by default (slate-900 bg)
- User messages: right-aligned, blue bubble
- Assistant messages: left-aligned, gray bubble with streaming cursor
- Auto-scroll to bottom on new message
- Textarea auto-resize, Shift+Enter for newline, Enter to send
- Disabled input while streaming

## Todo

- [ ] Define types in `src/types/chat.ts`
- [ ] Build `message-bubble.tsx`
- [ ] Build `message-list.tsx` with auto-scroll
- [ ] Build `chat-input.tsx`
- [ ] Build `chat-header.tsx`
- [ ] Build `chat-window.tsx` composing all parts

## Success Criteria

- Chat renders static mock messages correctly
- Input sends on Enter, newline on Shift+Enter
- Auto-scrolls to bottom
