export type Role = 'user' | 'assistant' | 'system';

/** OpenAI vision API content part */
export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image_url';
  image_url: { url: string; detail?: 'auto' | 'low' | 'high' };
}

export type ContentPart = TextPart | ImagePart;

export interface Message {
  id: string;
  role: Role;
  /** String for text-only, array for multimodal (text + images) */
  content: string | ContentPart[];
  /** Attached image URLs (base64 data URLs) for display purposes */
  images?: string[];
  /** true while streaming tokens */
  streaming?: boolean;
}

/** A named conversation stored in localStorage */
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
}

export const DEFAULT_CONFIG: ChatConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'https://api.openai.com',
  apiKey: import.meta.env.VITE_API_KEY ?? '',
  model: import.meta.env.VITE_API_MODEL ?? 'mycustom-chat',
  systemPrompt: 'You are a helpful assistant.',
};

/** Extract plain text from a message for display/title purposes */
export function getMessageText(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join(' ');
}
