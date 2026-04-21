import { useState, useCallback } from 'react';
import { apiBase } from '../lib/api-base';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export interface PendingUpload {
  id: string;
  preview: string; // base64 data URL for immediate display
  status: 'uploading' | 'done' | 'error';
  error?: string;
  uploadedUrl?: string; // MinIO URL once done
}

interface UseImageUploaderResult {
  pending: PendingUpload[];
  uploadFiles: (files: File[]) => void;
  removePending: (id: string) => void;
  clearPending: () => void;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function validateFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Only image files are allowed';
  if (file.size > MAX_BYTES) return 'File too large — max 10 MB';
  return null;
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadToBackend(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${apiBase}/upload`, { method: 'POST', body: form });
  const data = await res.json() as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data.url;
}

/**
 * Manages image upload state: base64 preview immediately, MinIO URL when done.
 * Caller reads `pending` for previews + `pending.filter(done).map(uploadedUrl)` for send.
 */
export function useImageUploader(): UseImageUploaderResult {
  const [pending, setPending] = useState<PendingUpload[]>([]);

  const uploadFiles = useCallback((files: File[]) => {
    files.forEach(async (file) => {
      const validationError = validateFile(file);
      if (validationError) {
        const id = generateId();
        setPending((prev) => [
          ...prev,
          { id, preview: '', status: 'error', error: validationError },
        ]);
        // Auto-remove error state after 4s
        setTimeout(() => setPending((prev) => prev.filter((p) => p.id !== id)), 4000);
        return;
      }

      const id = generateId();
      const preview = await readAsDataUrl(file);
      setPending((prev) => [...prev, { id, preview, status: 'uploading' }]);

      try {
        const uploadedUrl = await uploadToBackend(file);
        setPending((prev) =>
          prev.map((p) => p.id === id ? { ...p, status: 'done', uploadedUrl } : p)
        );
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Upload failed';
        setPending((prev) =>
          prev.map((p) => p.id === id ? { ...p, status: 'error', error } : p)
        );
      }
    });
  }, []);

  const removePending = useCallback((id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearPending = useCallback(() => setPending([]), []);

  return { pending, uploadFiles, removePending, clearPending };
}
