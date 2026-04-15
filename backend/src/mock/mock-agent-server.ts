/**
 * Mock Agent Server — dùng để test UI khi chưa có backend agent thật.
 *
 * Chạy: npx tsx src/mock/mock-agent-server.ts
 * Sau đó set: AGENT_URL=http://localhost:4000 trong .env
 *
 * POST / → nhận { query, image?, conversationId, history[] }
 *        → trả AgentResponse { data: { candidates: [...], relation: boolean } }
 *
 * Responses:
 *  - Chứa "quan hệ" / "liên quan" / "có liên hệ" → relation: true (entity pairs)
 *  - Còn lại → relation: false (single candidates)
 */

import { createServer } from 'node:http';

const PORT = 4000;

interface MockCandidate {
  id: string;
  doc_id: string;
  publish_date: string;
  title: string;
  label: string;
  name: string;
  text: string;
  properties: Record<string, string>;
}

interface MockRelationBlock {
  e1: MockCandidate;
  e2: MockCandidate;
  via: string;
  distance: number;
  target: 'e1' | 'e2';
}

// ── Sample entities ──────────────────────────────────────────────────────────

const NGUYEN_VAN_A: MockCandidate = {
  id: 'node-001',
  doc_id: 'doc-001',
  publish_date: '2024-01-15',
  title: 'Nguyễn Văn A — Giám đốc Công ty ABC',
  label: 'Person',
  name: 'Nguyễn Văn A',
  text: 'Nguyễn Văn A | profession: Giám đốc | addresss: Hà Nội',
  properties: {
    name: 'Nguyễn Văn A',
    profession: 'Giám đốc',
    role: 'CEO',
    organization: 'Công ty ABC',
    addresss: 'Hà Nội',
    gender: 'Nam',
    age_range: '45-50',
  },
};

const TRAN_THI_B: MockCandidate = {
  id: 'node-002',
  doc_id: 'doc-002',
  publish_date: '2024-02-10',
  title: 'Trần Thị B — Vợ của Nguyễn Văn A',
  label: 'Person',
  name: 'Trần Thị B',
  text: 'Trần Thị B | profession: Kế toán | addresss: Hà Nội',
  properties: {
    name: 'Trần Thị B',
    profession: 'Kế toán trưởng',
    role: 'Nhân viên',
    organization: 'Công ty XYZ',
    addresss: 'Hà Nội',
    gender: 'Nữ',
    age_range: '40-45',
  },
};

const NGUYEN_VAN_C: MockCandidate = {
  id: 'node-003',
  doc_id: 'doc-003',
  publish_date: '2024-03-01',
  title: 'Nguyễn Văn C — Anh trai của Nguyễn Văn A',
  label: 'Person',
  name: 'Nguyễn Văn C',
  text: 'Nguyễn Văn C | profession: Kỹ sư | addresss: Hà Nội',
  properties: {
    name: 'Nguyễn Văn C',
    profession: 'Kỹ sư phần mềm',
    role: 'Senior Engineer',
    organization: 'FPT Software',
    addresss: 'Hà Nội',
    gender: 'Nam',
    age_range: '48-53',
  },
};

const LE_VAN_D: MockCandidate = {
  id: 'node-004',
  doc_id: 'doc-004',
  publish_date: '2024-03-10',
  title: 'Lê Văn D — Đồng nghiệp của Nguyễn Văn A',
  label: 'Person',
  name: 'Lê Văn D',
  text: 'Lê Văn D | profession: Phó Giám đốc | addresss: Hà Nội',
  properties: {
    name: 'Lê Văn D',
    profession: 'Phó Giám đốc',
    role: 'COO',
    organization: 'Công ty ABC',
    addresss: 'Hà Nội',
    gender: 'Nam',
    age_range: '42-47',
  },
};

const CONG_TY_ABC: MockCandidate = {
  id: 'node-005',
  doc_id: 'doc-005',
  publish_date: '2024-01-01',
  title: 'Công ty ABC — Công ty phần mềm',
  label: 'Organization',
  name: 'Công ty ABC',
  text: 'Công ty ABC | profession: Công ty phần mềm | addresss: Hà Nội',
  properties: {
    name: 'Công ty ABC',
    profession: 'Công ty phần mềm',
    addresss: 'Hà Nội, Việt Nam',
    founded: '2010',
    employees: '200',
  },
};

// ── Relation blocks: Nguyễn Văn A → các người liên quan ─────────────────────

const RELATION_BLOCKS_NGUYEN_VAN_A: MockRelationBlock[] = [
  {
    e1: NGUYEN_VAN_A,
    e2: TRAN_THI_B,
    via: 'edge-vo-chong-001',
    distance: 1,
    target: 'e2',
  },
  {
    e1: NGUYEN_VAN_A,
    e2: NGUYEN_VAN_C,
    via: 'edge-anh-em-001',
    distance: 1,
    target: 'e2',
  },
  {
    e1: NGUYEN_VAN_A,
    e2: LE_VAN_D,
    via: 'edge-dong-nghiep-001',
    distance: 1,
    target: 'e2',
  },
  {
    e1: NGUYEN_VAN_A,
    e2: CONG_TY_ABC,
    via: 'edge-lanh-dao-001',
    distance: 1,
    target: 'e2',
  },
];

// ── Default single-entity candidates ─────────────────────────────────────────

const ALL_CANDIDATES: MockCandidate[] = [NGUYEN_VAN_A, TRAN_THI_B, NGUYEN_VAN_C, LE_VAN_D, CONG_TY_ABC];

// ── Response builder ──────────────────────────────────────────────────────────

function buildResponse(query: string): object {
  const q = query.toLowerCase();
  const isRelation = q.includes('quan hệ') || q.includes('liên quan') || q.includes('có liên hệ') || q.includes('liên hệ');

  console.log(`[mock-agent] query="${query}" → relation=${isRelation}`);

  return {
    data: {
      candidates: isRelation ? RELATION_BLOCKS_NGUYEN_VAN_A : ALL_CANDIDATES,
      relation: isRelation,
    },
  };
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body) as { query?: string };
      const query = parsed.query ?? '';
      const response = buildResponse(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[mock-agent] Running on http://localhost:${PORT}`);
  console.log('[mock-agent] Set AGENT_URL=http://localhost:4000 in your .env');
});
