import { useRef, useEffect, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { useImageUploader } from '../../hooks/use-image-uploader';

interface Props {
  onSend: (content: string, imageUrls: string[]) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  value: string;
  onChange: (value: string) => void;
}

export function ChatInput({ onSend, onStop, isStreaming, value, onChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pending, uploadFiles, removePending, clearPending } = useImageUploader();

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    const uploadedUrls = pending.filter((p) => p.status === 'done').map((p) => p.uploadedUrl!);
    const hasUploading = pending.some((p) => p.status === 'uploading');

    if ((!trimmed && uploadedUrls.length === 0) || isStreaming || hasUploading) return;

    onSend(trimmed || ' ', uploadedUrls);
    onChange('');
    clearPending();
  }, [value, pending, isStreaming, onSend, onChange, clearPending]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) uploadFiles(files);
    e.target.value = '';
  }, [uploadFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const imageFiles = Array.from(e.clipboardData.items)
      .filter((i) => i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
    if (imageFiles.length) uploadFiles(imageFiles);
  }, [uploadFiles]);

  const hasUploading = pending.some((p) => p.status === 'uploading');
  const uploadedCount = pending.filter((p) => p.status === 'done').length;
  const canSend = (value.trim() || uploadedCount > 0) && !isStreaming && !hasUploading;

  return (
    <div className="border-t border-slate-700 px-4 py-3 bg-slate-900">
      {/* Image previews */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pending.map((p) => (
            <div key={p.id} className="relative group/img">
              {/* Preview thumbnail or error placeholder */}
              {p.status === 'error' ? (
                <div className="w-16 h-16 rounded-lg border border-red-700 bg-red-900/30 flex items-center justify-center">
                  <span className="text-red-400 text-[9px] text-center px-1 leading-tight">{p.error}</span>
                </div>
              ) : (
                <div className="relative w-16 h-16">
                  <img
                    src={p.preview}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover border border-slate-600"
                  />
                  {/* Uploading spinner overlay */}
                  {p.status === 'uploading' && (
                    <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => removePending(p.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-600 hover:bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 bg-slate-800 rounded-xl px-3 py-2 border border-slate-700 focus-within:border-violet-500 transition-colors">
        {/* Image attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming}
          title="Attach image"
          className="shrink-0 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center transition-colors mb-0.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isStreaming}
          placeholder={hasUploading ? 'Uploading image...' : 'Type a message... (paste image with Ctrl+V)'}
          className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none outline-none py-1 min-h-[28px] max-h-[160px] disabled:opacity-50"
        />

        {isStreaming ? (
          <button
            onClick={onStop}
            className="shrink-0 w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors mb-0.5"
            title="Stop generation"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 w-8 h-8 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white flex items-center justify-center transition-colors mb-0.5"
            title={hasUploading ? 'Wait for upload to finish' : 'Send message'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-slate-600 text-xs mt-1.5 text-center">
        Enter to send · Shift+Enter for newline · Ctrl+V to paste image
      </p>
    </div>
  );
}
