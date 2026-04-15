# Phase 3 — API Integration (Streaming)

**Status:** ⬜ Todo  
**Priority:** High

## Overview

Hook up the chat to an OpenAI-compatible API with streaming support via `ReadableStream`.

## Files

| File | Purpose |
|------|---------|
| `src/lib/openai-client.ts` | Streaming fetch wrapper for OpenAI-compatible API |
| `src/hooks/use-chat.ts` | React hook managing messages, streaming state, send logic |

## API Flow

```
sendMessage(content) →
  POST /v1/chat/completions {stream: true} →
  ReadableStream chunks →
  decode SSE "data: {...}" lines →
  append delta to assistant message in state
```

## Key Implementation

```ts
// openai-client.ts
export async function* streamChat(config, messages): AsyncGenerator<string> {
  const res = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, messages, stream: true }),
  });
  // parse SSE chunks, yield delta.content
}
```

## Todo

- [ ] Implement `openai-client.ts` with SSE streaming parser
- [ ] Implement `use-chat.ts` hook
- [ ] Connect hook to `chat-window.tsx`
- [ ] Handle errors (network, 4xx, 5xx) gracefully
- [ ] Show error toast/inline message on failure

## Success Criteria

- Messages stream token by token in UI
- Errors show inline (not crash)
- Abort in-flight request on new send
