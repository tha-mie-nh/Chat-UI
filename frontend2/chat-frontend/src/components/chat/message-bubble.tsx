import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Message, ImagePart } from '../../types/chat';
import { getMessageText } from '../../types/chat';
import { CopyButton } from '../ui/copy-button';

interface Props {
  message: Message;
  onRegenerate?: () => void;
  isLast?: boolean;
}

/** Extract all image URLs from a message (supports both message.images and ContentPart[]) */
function extractImageUrls(message: Message): string[] {
  if (message.images && message.images.length > 0) return message.images;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((p): p is ImagePart => p.type === 'image_url')
      .map((p) => p.image_url.url);
  }
  return [];
}

export function MessageBubble({ message, onRegenerate, isLast }: Props) {
  const isUser = message.role === 'user';
  const textContent = getMessageText(message.content);
  const imageUrls = extractImageUrls(message);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 mt-1">
          AI
        </div>
      )}

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {/* Images — shown above text bubble */}
        {imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {imageUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`attachment ${i + 1}`}
                onClick={() => setLightboxUrl(url)}
                className="max-w-[200px] max-h-[200px] rounded-lg object-cover border border-slate-600 cursor-zoom-in hover:opacity-90 transition-opacity"
              />
            ))}
          </div>
        )}

        {/* Text bubble — only render if there is text */}
        {textContent && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              isUser
                ? 'bg-violet-600 text-white rounded-br-sm'
                : 'bg-slate-700 text-slate-100 rounded-bl-sm w-full'
            }`}
          >
            {isUser ? (
              <span className="whitespace-pre-wrap break-words">{textContent}</span>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    pre({ children, ...props }) {
                      return (
                        <div className="relative group/code my-2">
                          <pre {...props} className="rounded-lg overflow-x-auto text-xs p-3 bg-slate-900 border border-slate-600">
                            {children}
                          </pre>
                          <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                            <CopyButton text={extractCodeText(children)} />
                          </div>
                        </div>
                      );
                    },
                    code({ children, className, ...props }) {
                      const isBlock = !!className;
                      if (isBlock) return <code className={className} {...props}>{children}</code>;
                      return (
                        <code className="bg-slate-900 text-violet-300 px-1.5 py-0.5 rounded text-xs" {...props}>
                          {children}
                        </code>
                      );
                    },
                    a({ children, href, ...props }) {
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                          className="text-violet-400 hover:text-violet-300 underline" {...props}>
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {textContent}
                </ReactMarkdown>
                {message.streaming && (
                  <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        {!isUser && !message.streaming && (
          <div className={`flex items-center gap-1 mt-1.5 transition-opacity ${isLast ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <CopyButton text={textContent} label="Copy" />
            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-lg transition-colors"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function extractCodeText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractCodeText).join('');
  if (children && typeof children === 'object' && 'props' in (children as object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return extractCodeText((children as any).props.children);
  }
  return '';
}
