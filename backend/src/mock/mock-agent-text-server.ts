/**
 * Mock agent giả lập real FastAPI agent stream raw text chunks.
 * Real agent: StreamingResponse với Content-Type text/plain, yield từng đoạn text.
 *
 * Chạy: npx tsx src/mock/mock-agent-text-server.ts
 * Set: AGENT_URL=http://localhost:4003 trong backend/.env
 */

import { createServer } from 'node:http';

const PORT = 4003;
const WORD_DELAY_MS = 60;

const RESPONSES: Record<string, string> = {
  default: 'Xin chào! Tôi là trợ lý AI. Tôi có thể giúp bạn tra cứu thông tin về các cá nhân và tổ chức trong hệ thống dữ liệu graph.',
  nguyen: 'Nguyễn Văn A là Giám đốc của Công ty ABC, sinh năm 1975 tại Hà Nội. Ông có hơn 20 năm kinh nghiệm trong lĩnh vực công nghệ phần mềm và hiện đang lãnh đạo đội ngũ hơn 200 nhân viên tại Hà Nội.',
  tran: 'Trần Thị B là Kế toán trưởng tại Công ty XYZ, là vợ của Nguyễn Văn A. Bà tốt nghiệp Đại học Kinh tế Quốc dân và có hơn 15 năm kinh nghiệm trong lĩnh vực tài chính kế toán.',
  quan_he: 'Nguyễn Văn A có các mối quan hệ sau: vợ là Trần Thị B (Kế toán trưởng Công ty XYZ), anh trai là Nguyễn Văn C (Kỹ sư phần mềm FPT), đồng nghiệp là Lê Văn D (Phó Giám đốc Công ty ABC). Tất cả đều có quan hệ trực tiếp với khoảng cách 1 trong graph.',
};

function pickResponse(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('quan hệ') || q.includes('liên quan')) return RESPONSES.quan_he;
  if (q.includes('nguyễn') || q.includes('nguyen')) return RESPONSES.nguyen;
  if (q.includes('trần') || q.includes('tran')) return RESPONSES.tran;
  return RESPONSES.default;
}

const server = createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405); res.end('Method Not Allowed'); return;
  }

  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body) as { query?: string };
      const query = parsed.query ?? '';
      const answer = pickResponse(query);
      const words = answer.split(' ');
      console.log(`[mock-agent] query="${query}" → streaming ${words.length} words...`);

      // Stream raw text chunks — giống FastAPI StreamingResponse yield plain string
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });

      let cancelled = false;
      res.on('close', () => { cancelled = true; });

      const sendNext = (i: number) => {
        if (cancelled) return;
        if (i >= words.length) { res.end(); return; }
        res.write(i === 0 ? words[i] : ' ' + words[i]);
        setTimeout(() => sendNext(i + 1), WORD_DELAY_MS);
      };
      sendNext(0);
    } catch {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[mock-agent] Running on http://localhost:${PORT}`);
  console.log(`[mock-agent] Streams raw text chunks, ${WORD_DELAY_MS}ms/word`);
});
