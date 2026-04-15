# Phase 4 — Settings Panel

**Status:** ⬜ Todo  
**Priority:** Medium

## Overview

Settings slide-over panel allowing user to configure API URL, API key, and model.

## Files

| File | Purpose |
|------|---------|
| `src/components/settings/settings-panel.tsx` | Slide-over panel UI |
| `src/hooks/use-config.ts` | Config state + localStorage persistence |

## Config Schema

```ts
interface ChatConfig {
  baseUrl: string;   // e.g. https://api.openai.com
  apiKey: string;    // stored in localStorage
  model: string;     // e.g. gpt-4o
  systemPrompt: string;
}
```

## Defaults (from env vars at build time)

```
VITE_API_BASE_URL=https://api.openai.com
VITE_API_MODEL=gpt-4o
```

## Todo

- [ ] Implement `use-config.ts` with localStorage read/write
- [ ] Build settings panel with form fields
- [ ] Mask API key input (type=password)
- [ ] Persist on save, close on cancel
- [ ] Wire gear icon in header to open panel

## Success Criteria

- Config persists across page refresh
- Env vars used as defaults when localStorage empty
- API key masked in input
