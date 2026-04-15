# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```



<!-- Bước 1 — Build images:
cd ~/chatUI
docker-compose build --no-cache
Bước 2 — Tag images:
docker tag chatbot-frontend gthanh/chatbot-frontend:latest
docker tag chatbot-backend gthanh/chatbot-backend:latest
Bước 3 — Login Docker Hub:
docker login -u gthanh
# Nhập Personal Access Token (không phải password)
Bước 4 — Push:
docker push gthanh/chatbot-frontend:latest
docker push gthanh/chatbot-backend:latest
Bước 5 — Verify:
Vào hub.docker.com/u/gthanh
Kiểm tra timestamp images đã update chưa

Lưu nhanh vào file để dùng lại:
nano ~/chatUI/scripts/push.sh
#!/bin/
cd ~/chatUI
docker-compose build --no-cache
docker tag chatbot-frontend gthanh/chatbot-frontend:latest
docker tag chatbot-backend gthanh/chatbot-backend:latest
docker push gthanh/chatbot-frontend:latest
docker push gthanh/chatbot-backend:latest
echo "Done!"
chmod +x ~/chatUI/scripts/push.sh
# Chạy: ./scripts/push.sh -->