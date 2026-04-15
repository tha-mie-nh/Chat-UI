import { Routes, Route } from 'react-router-dom';
import { ChatWindow } from './components/chat/chat-window';
import { ConversationRedirect } from './components/chat/conversation-redirect';
import { NotFound } from './components/chat/not-found';

export default function App() {
  return (
    <Routes>
      {/* / → redirect to last conversation or create new */}
      <Route path="/" element={<ConversationRedirect />} />

      {/* /:conversationId → load specific conversation */}
      <Route path="/:conversationId" element={<ChatWindow />} />

      {/* catch-all 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
