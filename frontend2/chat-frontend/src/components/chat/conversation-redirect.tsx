import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';

/**
 * Handles / route:
 * - Fetches conversation list
 * - Redirects to latest conversation if exists
 * - Creates a new conversation and redirects to it otherwise
 */
export function ConversationRedirect() {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolveTarget() {
      try {
        const list = await apiClient.listConversations();
        if (list.length > 0) {
          setTargetId(list[0].id);
        } else {
          const created = await apiClient.createConversation();
          setTargetId(created.id);
        }
      } catch {
        // Backend down — stay on / and show nothing (backend 503 will show in UI)
        setLoading(false);
      }
    }
    resolveTarget();
  }, []);

  if (loading && !targetId) {
    return (
      <div className="flex h-screen bg-slate-900 items-center justify-center">
        <div className="w-5 h-5 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (targetId) return <Navigate to={`/${targetId}`} replace />;
  return null;
}
