import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

// Support both MONGODB_URL (docker-compose standard) and legacy MONGO_URL
const MONGO_URL = process.env.MONGODB_URL ?? process.env.MONGO_URL ?? 'mongodb://localhost:27017/chatui';

export async function connectDB(): Promise<void> {
  await mongoose.connect(MONGO_URL);
  console.log(`MongoDB connected: ${MONGO_URL}`);
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const conversationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    title: { type: String, default: 'New conversation' },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { versionKey: false }
);

const messageSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    conversationId: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    createdAt: { type: Number, default: () => Date.now() },
  },
  { versionKey: false }
);

export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
