import 'dotenv/config';
import { mkdir } from 'node:fs/promises';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { UPLOADS_DIR } from './lib/storage-client.js';
import conversationsRouter from './routes/conversations.js';
import chatRouter from './routes/chat.js';
import uploadRouter from './routes/upload.js';
import historyRouter from './routes/history.js';

// ── Backend API Server ─────────────────────────────────────────────────────────
// là một entry point , tập trung vào việc khởi động server
// khởi động server, kết nối DB, thiết lập các route và middleware
// middleware kiểm tra DB trước khi vào route, trả 503 nếu DB chưa sẵn sàng





const app = new Hono();

const port = Number(process.env.PORT ?? 3001);

// ── MongoDB readiness flag ────────────────────────────────────────────────────
let dbReady = false;

// Reset flag on disconnect so middleware returns 503 instead of crashing
mongoose.connection.on('disconnected', () => {
  dbReady = false;
  console.warn('[MongoDB] Disconnected — API returning 503 until reconnected.');
});

// Allow all origins — no CORS restriction
app.use('*', cors());

// Serve uploaded images — /uploads/YYYY-MM-DD/uuid.ext → UPLOADS_DIR/...
app.use('/uploads/*', serveStatic({ root: process.env.UPLOADS_DIR ?? './uploads',
  rewriteRequestPath: (p) => p.replace('/uploads', '') }));

// Health check — always available even when DB is down
app.get('/health', (c) => c.json({ ok: true, db: dbReady }));

// DB check middleware MUST be registered before routes so it intercepts them
app.use('/api/*', async (c, next) => {
  if (!dbReady) {
    return c.json({ error: 'Database not available. Please try again later.' }, 503);
  }
  return next();
});

// Routes — only reachable when DB is ready
app.route('/api/conversations', conversationsRouter);
app.route('/api/conversations', chatRouter);

// History route — for backend agent consumption (requires X-Internal-Key)
app.route('/api/conversations', historyRouter);

// Upload route — available without DB (storage is independent)
app.route('/api/upload', uploadRouter);

// ── Startup ───────────────────────────────────────────────────────────────────

async function startServer() {
  await mkdir(UPLOADS_DIR, { recursive: true });
  console.log(`[uploads] storage dir ready: ${UPLOADS_DIR}`);

  try {
    await connectDB();
    dbReady = true;
    console.log('MongoDB connected successfully.');
  } catch (err) {
    console.error('[FATAL] Could not connect to MongoDB on startup:', err);
    console.error('Server will start — API calls return 503 until DB is reachable.');
  }

  serve({ fetch: app.fetch, port }, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

// Re-attempt connection every 5 s if initial connect failed
async function reconnectLoop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, 5000));
    if (dbReady) continue; // already connected
    try {
      await connectDB();
      dbReady = true;
      console.log('[RECOVERY] MongoDB reconnected.');
    } catch {
      // silent — already warned at startup
    }
  }
}

startServer();
reconnectLoop();
