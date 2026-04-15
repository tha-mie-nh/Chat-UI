# Phase 1 — Project Setup

**Status:** ⬜ Todo  
**Priority:** High

## Overview

Scaffold Vite + React 18 + TypeScript + Tailwind CSS project.

## Implementation Steps

1. `npm create vite@latest . -- --template react-ts`
2. Install Tailwind: `npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p`
3. Configure `tailwind.config.js` — content paths
4. Update `src/index.css` with Tailwind directives
5. Clean up default Vite boilerplate (`App.tsx`, `App.css`)
6. Set up folder structure:
   ```
   src/
   ├── components/
   │   ├── chat/
   │   └── settings/
   ├── hooks/
   ├── lib/
   ├── types/
   └── main.tsx
   ```

## Todo

- [ ] Init Vite project
- [ ] Install + configure Tailwind
- [ ] Clean boilerplate
- [ ] Create folder structure

## Success Criteria

- `npm run dev` runs without errors
- Tailwind classes apply in browser
