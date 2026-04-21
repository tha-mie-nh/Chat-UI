import { useState, type FormEvent } from 'react';
import type { ChatConfig } from '../../types/chat';

interface Props {
  config: ChatConfig;
  onSave: (updates: Partial<ChatConfig>) => void;
  onClose: () => void;
}

export function SettingsPanel({ config, onSave, onClose }: Props) {
  const [form, setForm] = useState<ChatConfig>({ ...config });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  const set = (key: keyof ChatConfig) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="w-full max-w-sm h-full bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-slate-100 font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <Field label="API Base URL" hint="e.g. https://api.openai.com">
            <input
              type="url"
              value={form.baseUrl}
              onChange={set('baseUrl')}
              placeholder="https://api.openai.com"
              className={inputClass}
            />
          </Field>

          <Field label="API Key" hint="Stored in browser localStorage only">
            <input
              type="password"
              value={form.apiKey}
              onChange={set('apiKey')}
              placeholder="sk-..."
              autoComplete="off"
              className={inputClass}
            />
          </Field>

          <Field label="Model">
            <input
              type="text"
              value={form.model}
              onChange={set('model')}
              placeholder="gpt-4o"
              className={inputClass}
            />
          </Field>

          <Field label="System Prompt">
            <textarea
              value={form.systemPrompt}
              onChange={set('systemPrompt')}
              rows={4}
              placeholder="You are a helpful assistant."
              className={`${inputClass} resize-none`}
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-slate-600 text-xs">{hint}</p>}
    </div>
  );
}
