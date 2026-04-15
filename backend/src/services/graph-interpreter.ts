// Graph interpreter service — bridges backend agent graph data and Gemini LLM.
// getGraphData() calls real backend agent via AGENT_URL with full context.
// Gemini formats a natural-language response from the returned graph.

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface HistoryItem { role: 'user' | 'assistant'; content: string; }
export interface ImageData   { base64: string; mimeType: string; }

// ── Agent output types (matches real backend agent response) ──

/** Single candidate entity from agent (non-relation query) */
export interface AgentCandidate {
  id: string;
  doc_id: string;
  publish_date: string;
  title: string;
  label: string;              // "Person" | "Organization" | etc.
  name: string;
  text: string;               // e.g. "Công ty NCS | profession: Công ty phần mềm | addresss: Việt Nam"
  properties: Record<string, string>;  // { name, profession, addresss, role, ... }
}

/** Relation block from agent (relation query) */
export interface AgentRelationBlock {
  e1: AgentCandidate;
  e2: AgentCandidate;
  via: string;                // Edge ID
  distance: number;           // Graph distance (smaller = closer/better match)
  target: 'e1' | 'e2';        // Which entity the user wants as result
}

/** Full agent response */
export interface AgentResponse {
  data: {
    candidates: AgentCandidate[] | AgentRelationBlock[];
    relation: boolean;        // false = single entity search, true = relation query
  };
}

const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

// ── 1. Data retrieval via backend agent ──────────────────────────────────────

/**
 * Calls AGENT_URL with full context: query + image + conversationId + history.
 * Throws Error if AGENT_URL not configured → caller returns 503.
 * Timeout: 30s.
 *
 * Returns AgentResponse: { data: { candidates: [...], relation: boolean } }
 * - relation: false → candidates là array AgentCandidate (tìm 1 entity)
 * - relation: true  → candidates là array AgentRelationBlock (tìm có quan hệ)
 */
async function getGraphData(
  userMessage: string,
  conversationId: string,
  history: HistoryItem[],
  imageBase64?: string
): Promise<AgentResponse> {
  const agentUrl = process.env.AGENT_URL;
  if (!agentUrl) throw new Error('AGENT_URL chưa được cấu hình. Vui lòng set AGENT_URL trong file .env');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: userMessage,
        image: imageBase64 ?? null,
        conversationId,
        history: history.map((h) => ({ role: h.role, content: h.content })),
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Agent returned HTTP ${response.status}`);

    const rawData = await response.json();
    return rawData as AgentResponse;
  } finally {
    clearTimeout(timeout);
  }
}

// ── [MOCK — disabled] CSV-based graph retrieval ───────────────────────────────
// import { ALL_NODES, ALL_EDGES } from '../mock/csv-data-loader.js';
//
// const ALL_NAMES: string[] = [...new Set(ALL_NODES.map((n: GraphNode) => n.name))];
//
// function detectNames(q: string): string[] {
//   return ALL_NAMES.filter((name) => {
//     const lower = name.toLowerCase();
//     const ascii = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
//     return q.includes(lower) || q.includes(ascii);
//   });
// }
//
// function getGraphDataMock(userMessage: string): { graph: GraphData; totalCount: number; hints: string } {
//   const q = userMessage.toLowerCase();
//   const matchedNames = detectNames(q);
//   const allMatched: GraphNode[] = matchedNames.length > 0
//     ? ALL_NODES.filter((n: GraphNode) => new Set(matchedNames).has(n.name))
//     : [];
//   const totalCount = allMatched.length;
//   const MAX = 10;
//   const hints = totalCount > MAX ? diversityHints(allMatched) : '';
//   const topNodes = totalCount > MAX
//     ? [...allMatched].sort((a, b) => b.confidence_score - a.confidence_score).slice(0, MAX)
//     : allMatched;
//   const nodeIds = new Set(topNodes.map((n: GraphNode) => n.id));
//   const edges = ALL_EDGES.filter((e: { from: string; to: string }) => nodeIds.has(e.from) && nodeIds.has(e.to));
//   return { graph: { nodes: topNodes, edges }, totalCount, hints };
// }
// ── [END MOCK] ────────────────────────────────────────────────────────────────

// ── [MOCK — disabled] Image appearance analysis ───────────────────────────────
// analyzeImage(), normalizeAppearance(), filterByAppearance() removed.
// Image is now forwarded directly to AGENT_URL as base64 in the payload.
// ── [END MOCK] ────────────────────────────────────────────────────────────────

// ── [DEPRECATED — GraphData flow, kept for rollback] ─────────────────────────
// const MAX_NODES_TO_GEMINI = 10;
//
// /** Count distinct values per attribute — used for narrowing suggestions. */
// function diversityHints(nodes: GraphNode[]): string {
//   if (nodes.length <= 1) return '';
//   const attrs: Array<{ label: string; get: (n: GraphNode) => string }> = [
//     { label: 'thành phố',            get: (n) => n.city },
//     { label: 'nghề nghiệp',          get: (n) => n.job },
//     { label: 'độ tuổi',              get: (n) => n.appearance?.age_range ?? '' },
//     { label: 'giới tính',            get: (n) => n.gender },
//     { label: 'học vấn',              get: (n) => n.education },
//     { label: 'tình trạng hôn nhân',  get: (n) => n.marital_status },
//     { label: 'thu nhập',             get: (n) => n.income_level },
//     { label: 'tỉnh/thành',           get: (n) => n.province },
//   ];
//   const ranked = attrs
//     .map((a) => {
//       const counts: Record<string, number> = {};
//       nodes.forEach((n) => { const v = a.get(n); if (v) counts[v] = (counts[v] ?? 0) + 1; });
//       const uniq = Object.entries(counts).sort((x, y) => y[1] - x[1]);
//       return { label: a.label, uniq, count: uniq.length };
//     })
//     .filter((a) => a.count >= 2)
//     .sort((a, b) => b.count - a.count)
//     .slice(0, 2);
//   if (ranked.length === 0) return '';
//   return ranked.map((a) => {
//     const vals = a.uniq.map(([v, c]) => `${v} (${c})`).join(', ');
//     return `- Theo ${a.label}: ${vals}`;
//   }).join('\n');
// }
//
// function buildSystemInstruction(graph: GraphData, totalCount = 0, hints = ''): string {
//   const isLarge = totalCount > MAX_NODES_TO_GEMINI;
//   const largeRule = isLarge ? `
// KẾT QUẢ: tổng ${totalCount} người khớp — đang hiển thị ${graph.nodes.length} người tiêu biểu.
// QUY TẮC: liệt kê ${graph.nodes.length} người này, thông báo "Tìm thấy ${totalCount} người, hiển thị ${graph.nodes.length} tiêu biểu", gợi ý thu hẹp:
// ${hints}` : '';
//
//   return `Bạn là trợ lý tra cứu thông tin nhân khẩu học từ dữ liệu graph.
//
// NHIỆM VỤ:
// - Phân tích dữ liệu graph (nodes = thông tin người, edges = quan hệ: vợ chồng/anh em/đồng nghiệp/bạn bè/họ hàng)
// - Dựa vào lịch sử hội thoại để hiểu ngữ cảnh, hội tụ kết quả khi user thêm điều kiện
// - Trả lời bằng tiếng Việt tự nhiên, ngắn gọn, có cấu trúc rõ ràng
// ${largeRule}
// QUY TẮC BẮT BUỘC:
// - KHÔNG bịa thêm thông tin ngoài dữ liệu graph
// - Nếu ≤ ${MAX_NODES_TO_GEMINI} kết quả: liệt kê đầy đủ, hỏi user muốn xem chi tiết ai
// - Nếu user thêm điều kiện: dùng lịch sử hội thoại để hội tụ vào đúng đối tượng
// - Nếu không tìm thấy: trả lời thẳng "Không tìm thấy thông tin phù hợp trong dữ liệu"
// - Khi nêu quan hệ: nêu rõ loại quan hệ và thông tin cả hai bên
// - Nếu graph rỗng (nodes = []): hỏi user muốn tìm ai cụ thể
//
// DỮ LIỆU GRAPH:
// \`\`\`json
// ${JSON.stringify(graph, null, 2)}
// \`\`\``;
// }
// ── [END DEPRECATED] ─────────────────────────────────────────────────────────

// ── System instruction for relation query (relation: true) ──

/**
 * Builds system instruction for AgentRelationBlock[] format.
 * Used when agent returns entity pairs connected by graph edges.
 * Example query: "Tìm thông tin về công ty NCS có liên quan đến ông Vũ Ngọc Sơn"
 */
function buildRelationSystemInstruction(
  blocks: AgentRelationBlock[],
  userQuery: string
): string {
  return `Bạn là trợ lý tra cứu thông tin từ dữ liệu graph.

NGỮ CẢNH: User hỏi: "${userQuery}"

DỮ LIỆU: Agent trả về ${blocks.length} khối entity pairs có quan hệ trong graph:
- Mỗi khối có: e1 (entity 1), e2 (entity 2), via (ID cạnh quan hệ), distance (khoảng cách), target (entity user muốn)
- Mỗi entity có: name, label (Person/Organization), title, text, properties (thông tin chi tiết)
- distance càng NHỎ = 2 entities càng GẦN nhau trong graph = match TỐT hơn
- target chỉ định entity nào là kết quả user cần tìm (e1 hoặc e2)
- via là ID của cạnh nối e1 và e2 trong graph

NHIỆM VỤ:
1. Xếp hạng các blocks theo distance (ưu tiên distance nhỏ nhất)
2. Chọn blocks phù hợp nhất với query của user
3. Trả về entity được chỉ định trong "target" của block tốt nhất
4. Giải thích mối quan hệ giữa e1 và e2 dựa trên context của block

QUY TẮC BẮT BUỘC:
- Nếu query có tên cụ thể (VD: "tìm công ty NCS"): ưu tiên blocks có e1/e2.name match tên đó
- Trả lời bằng tiếng Việt, ngắn gọn, có cấu trúc
- Nêu rõ: tên entity + label + thông tin từ properties/text + mối quan hệ với entity còn lại
- Nếu không có block nào match: "Không tìm thấy thông tin phù hợp"
- KHÔNG bịa thêm thông tin ngoài dữ liệu blocks

DỮ LIỆU BLOCKS:
\`\`\`json
${JSON.stringify(blocks, null, 2)}
\`\`\``;
}

// ── System instruction for single entity search (relation: false) ──

/**
 * Builds system instruction for AgentCandidate[] format.
 * Used when user searches for a single entity (no relationship query).
 * Example query: "Tìm thông tin về công ty NCS"
 */
function buildSingleEntitySystemInstruction(
  candidates: AgentCandidate[],
  userQuery: string
): string {
  return `Bạn là trợ lý tra cứu thông tin từ dữ liệu graph.

NGỮ CẢNH: User hỏi: "${userQuery}"

DỮ LIỆU: Agent trả về ${candidates.length} ứng viên (candidates):
- Mỗi candidate có: name, label (Person/Organization), title, text, properties (thông tin chi tiết)
- properties chứa các thuộc tính như: profession, role, position, organization, addresss, ...
- text là mô tả ngắn gọn của entity (VD: "Công ty NCS | profession: Công ty phần mềm | addresss: Việt Nam")

NHIỆM VỤ:
1. Chọn candidate phù hợp nhất với query của user
2. Trả về thông tin chi tiết của candidate đó (name, label, properties, text)
3. Nếu có nhiều candidates trùng tên: tổng hợp thông tin từ tất cả, nêu rõ các nguồn khác nhau

QUY TẮC BẮT BUỘC:
- Nếu query có tên cụ thể (VD: "tìm công ty NCS"): ưu tiên candidates có name match tên đó
- Trả lời bằng tiếng Việt, ngắn gọn, có cấu trúc
- Nêu rõ: tên entity + label + các thông tin quan trọng từ properties
- Nếu có nhiều kết quả: liệt kê đầy đủ, hỏi user muốn xem chi tiết cái nào
- Nếu không có candidate nào match: "Không tìm thấy thông tin phù hợp"
- KHÔNG bịa thêm thông tin ngoài dữ liệu candidates

DỮ LIỆU CANDIDATES:
\`\`\`json
${JSON.stringify(candidates, null, 2)}
\`\`\``;
}

// ── 3. Main interpreter ───────────────────────────────────────────────────────

/**
 * Full pipeline: get graph from agent → build Gemini prompt → return text response.
 * @param userMessage    Plain text from user (may be empty if image-only)
 * @param history        Previous messages from MongoDB (EXCLUDING current message)
 * @param conversationId MongoDB conversation ID — forwarded to agent for context
 * @param imageData      Optional base64 image — forwarded to agent for visual search
 */
export async function interpretGraph(
  userMessage: string,
  history: HistoryItem[],
  conversationId: string,
  imageData?: ImageData
): Promise<string> {
  // No GEMINI_API_KEY → bypass Gemini, return raw agent response directly
  if (!process.env.GEMINI_API_KEY) {
    const agentUrl = process.env.AGENT_URL;
    if (!agentUrl) throw new Error('AGENT_URL chưa được cấu hình');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage,
          image: imageData?.base64 ?? null,
          conversationId,
          history: history.map((h) => ({ role: h.role, content: h.content })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Agent returned HTTP ${res.status}`);
      const data: unknown = await res.json();
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    } finally {
      clearTimeout(timeout);
    }
  }

  const response = await getGraphData(userMessage, conversationId, history, imageData?.base64);

  // ── Branch on data.relation boolean ──
  const isRelation = response.data.relation;

  const systemInstruction = isRelation
    ? buildRelationSystemInstruction(response.data.candidates as AgentRelationBlock[], userMessage)
    : buildSingleEntitySystemInstruction(response.data.candidates as AgentCandidate[], userMessage);

  const model = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction });

  const geminiHistory = history.map((h) => ({
    role: h.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: h.content }],
  }));

  const textToSend = userMessage.trim() || (isRelation
    ? 'Đánh giá các entity blocks và trả về kết quả phù hợp nhất'
    : 'Tìm entity phù hợp với yêu cầu');

  // Retry up to 3 times on transient Gemini 503 errors
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const chat   = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(textToSend);
      return result.response.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < 3 && msg.includes('503')) {
        console.warn(`[interpretGraph] 503 on attempt ${attempt}, retry in 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Unreachable');

  // ── [DEPRECATED — Old GraphBlock/GraphData flow, kept for rollback] ───────────────────
  // const blocks = await getGraphData(userMessage, conversationId, history, imageData?.base64);
  // const hasRelation = blocks.length > 0 && !!blocks[0]?.relation;
  // const systemInstruction = hasRelation
  //   ? buildBlockSystemInstruction(blocks, userMessage)
  //   : buildSingleEntitySystemInstruction(blocks, userMessage);
  // ... Gemini call
  // ── [END DEPRECATED] ────────────────────────────────────────────────────────
}
