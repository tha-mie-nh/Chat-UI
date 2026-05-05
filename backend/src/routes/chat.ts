// Chat route: nhận message → lưu DB → gọi agent → stream/return response → lưu DB

import { Hono } from 'hono';
import { Conversation, Message } from '../db.js';
import { createAgentStream, type HistoryItem } from '../services/graph-interpreter.js';

/** Download ảnh từ MinIO URL → data URL "data:image/png;base64,..." */
async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cannot fetch image: HTTP ${res.status}`);
  const mimeType = (res.headers.get('Content-Type') ?? 'image/jpeg').split(';')[0];
  const base64 = Buffer.from(await res.arrayBuffer()).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

const router = new Hono();

/** POST /api/conversations/:id/chat?stream=true|false */
router.post('/:id/chat', async (c) => {
  const convId = c.req.param('id');
  const conv = await Conversation.findById(convId);
  if (!conv) return c.json({ error: 'Conversation not found' }, 404);

  let userText: string;
  let imageUrls: string[] = [];
  let lastContent: unknown;
  try {
    const body = await c.req.json<{ messages: Array<{ role: string; content: unknown }> }>();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: 'messages must be a non-empty array' }, 400);
    }
    const last = body.messages.at(-1)!;
    if (last.role !== 'user') return c.json({ error: 'Last message must be from user' }, 400);
    lastContent = last.content;
    userText =
      typeof last.content === 'string'
        ? last.content
        : (last.content as Array<{ type: string; text?: string }>)
            ?.find?.((p) => p.type === 'text')?.text ?? '';
    imageUrls =
      typeof last.content === 'string'
        ? []
        : (last.content as Array<{ type: string; image_url?: { url: string } }>)
            .filter((p) => p.type === 'image_url' && p.image_url?.url)
            .map((p) => p.image_url!.url);
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const hasImage    = imageUrls.length > 0;
  const isImageOnly = hasImage && !userText.trim();
  if (!userText.trim() && imageUrls.length === 0) return c.json({ error: 'Empty message' }, 400);

  console.log(`[chat] conv=${convId} text="${userText.slice(0, 60)}" images=${imageUrls.length} path=${hasImage ? 'image' : 'text'}`);

  const now = Date.now();

  // Auto-title từ message đầu tiên
  const msgCount = await Message.countDocuments({ conversationId: convId });
  if (msgCount === 0) conv.title = userText.slice(0, 60) || '📷 Nhận diện ảnh';
  conv.updatedAt = now;
  await conv.save();

  await Message.create({
    conversationId: convId,
    role: 'user',
    content: lastContent,
    createdAt: now,
  });

  const prevMessages = await Message.find({ conversationId: convId, createdAt: { $lt: now } })
    .sort({ createdAt: 1 })
    .limit(20);

  const history: HistoryItem[] = prevMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));

  // ── Image path ────────────────────────────────────────────────────────────
  // IMAGE_SERVICE_URL set → test path (mock orchestrator)
  // IMAGE_SERVICE_URL không set → production path (AGENT_URL + base64)
  if (hasImage) {
    const imageServiceUrl = process.env.IMAGE_SERVICE_URL;

    // ── Production path ───────────────────────────────────────────────────
    if (!imageServiceUrl) {
      console.log(`[chat:image:prod] fetching base64 from ${imageUrls[0]}`);
      let imageDataUrl: string;
      try {
        imageDataUrl = await fetchImageAsDataUrl(imageUrls[0]);
        console.log(`[chat:image:prod] ✓ base64 ready, sending to AGENT_URL`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[chat:image:prod] ✗ fetch image error:', msg);
        return c.json({ error: 'Failed to fetch image from storage', detail: msg }, 502);
      }

      let agentStream: Awaited<ReturnType<typeof createAgentStream>>;
      try {
        agentStream = await createAgentStream(userText, history, convId, imageDataUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[chat:image:prod] ✗ agent error:', msg);
        return c.json({ error: 'Agent error', detail: msg }, 502);
      }

      const { isStreaming, chunks } = agentStream;
      const title = conv.title;
      console.log(`[chat:image:prod] agent responded, isStreaming=${isStreaming}`);

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          let fullAnswer = '';
          try {
            for await (const chunk of chunks) {
              fullAnswer += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`));
            }
            await Message.create({ conversationId: convId, role: 'assistant', content: fullAnswer, createdAt: now + 1 });
            console.log(`[chat:image:prod] ✓ done, answer=${fullAnswer.length} chars`);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', title })}\n\n`));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[chat:image:prod] ✗ stream error:', msg);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });
      return new Response(readableStream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
      });
    }

    // ── Test path (mock orchestrator) ─────────────────────────────────────

    console.log(`[chat:image] → ${imageServiceUrl} imageUrl=${imageUrls[0]} query="${userText.trim() || '(none)'}"`);

    let imageRes: Response;
    try {
      imageRes = await fetch(imageServiceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imageUrls[0], conversationId: convId, query: userText.trim() || undefined }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[chat:image] ✗ fetch error:', msg);
      return c.json({ error: 'Image service error', detail: msg }, 502);
    }

    if (!imageRes.ok || !imageRes.body) {
      console.error(`[chat:image] ✗ image-svc HTTP ${imageRes.status}`);
      return c.json({ error: `Image service HTTP ${imageRes.status}` }, 502);
    }

    console.log(`[chat:image] image-svc responded HTTP ${imageRes.status}, streaming to client...`);

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullAnswer = '';
        try {
          const reader = imageRes.body!.getReader();
          const dec = new TextDecoder();
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop()!;
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (!raw || raw === '[DONE]') continue;
              fullAnswer += raw;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: raw })}\n\n`));
            }
          }
          await Message.create({ conversationId: convId, role: 'assistant', content: fullAnswer.trim(), createdAt: now + 1 });
          console.log(`[chat:image] ✓ done, answer=${fullAnswer.trim().length} chars`);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', title: conv.title })}\n\n`));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[chat:image] ✗ stream error:', msg);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(readableStream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  }

  // ── Gọi agent, auto-detect streaming từ Content-Type ─────────────────────
  console.log(`[chat:text] → agent text="${userText.slice(0, 60)}" history=${history.length}msgs`);
  let agentStream: Awaited<ReturnType<typeof createAgentStream>>;
  try {
    agentStream = await createAgentStream(userText, history, convId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[chat:text] ✗ agent error:', msg);
    return c.json({ error: 'Agent error', detail: msg }, 502);
  }

  const { isStreaming, chunks } = agentStream;
  console.log(`[chat:text] agent responded, isStreaming=${isStreaming}`);
  const title = conv.title;

  if (isStreaming) {
    // Agent stream (text/plain, SSE) → pipe chunks → SSE → FE
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullAnswer = '';
        try {
          for await (const chunk of chunks) {
            fullAnswer += chunk;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
            );
          }
          await Message.create({ conversationId: convId, role: 'assistant', content: fullAnswer, createdAt: now + 1 });
          console.log(`[chat:text] ✓ stream done, answer=${fullAnswer.length} chars`);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', title })}\n\n`)
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[chat:text] ✗ stream error:', msg);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // Agent trả JSON 1 cục → tích lũy → trả JSON về FE
  let answer = '';
  try {
    for await (const chunk of chunks) answer += chunk;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[chat:text] ✗ json error:', msg);
    return c.json({ error: 'Agent error', detail: msg }, 502);
  }

  await Message.create({ conversationId: convId, role: 'assistant', content: answer, createdAt: now + 1 });
  console.log(`[chat:text] ✓ json done, answer=${answer.length} chars`);
  return c.json({ role: 'assistant', content: answer, title });
});

export default router;
