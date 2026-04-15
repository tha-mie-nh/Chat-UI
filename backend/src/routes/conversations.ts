import { Hono } from 'hono';
import { Conversation, Message } from '../db.js';

const router = new Hono();

/** GET /api/conversations — list all, ordered by latest activity */
router.get('/', async (c) => {
  const convs = await Conversation.find().sort({ updatedAt: -1 }).lean();
  return c.json(convs.map((d) => ({
    id: d._id,
    title: d.title,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  })));
});

/** POST /api/conversations — create empty conversation */
router.post('/', async (c) => {
  const conv = await Conversation.create({});
  return c.json({ id: conv._id, title: conv.title, created_at: conv.createdAt, updated_at: conv.updatedAt }, 201);
});

/** GET /api/conversations/:id — get conversation with messages */
router.get('/:id', async (c) => {
  const id = c.req.param('id');
  const conv = await Conversation.findById(id).lean();
  if (!conv) return c.json({ error: 'Not found' }, 404);

  const msgs = await Message.find({ conversationId: id }).sort({ createdAt: 1 }).lean();
  return c.json({
    id: conv._id,
    title: conv.title,
    created_at: conv.createdAt,
    updated_at: conv.updatedAt,
    messages: msgs.map((m) => ({ id: m._id, role: m.role, content: m.content, created_at: m.createdAt })),
  });
});

/** DELETE /api/conversations/:id */
router.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await Promise.all([
    Conversation.findByIdAndDelete(id),
    Message.deleteMany({ conversationId: id }),
  ]);
  return new Response(null, { status: 204 });
});

export default router;
