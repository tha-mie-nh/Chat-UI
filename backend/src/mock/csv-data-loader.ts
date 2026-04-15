// Loads graph data from people.csv and relations.csv at module init.
// Drop-in replacement for the hardcoded ALL_NODES / ALL_EDGES from graph-data.ts.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { GraphNode, GraphEdge, GraphData } from './graph-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').trim(); });
    return row;
  });
}

// ── people.csv → GraphNode[] ──────────────────────────────────────────────────

function loadNodes(): GraphNode[] {
  const raw = readFileSync(join(__dirname, 'people.csv'), 'utf-8');
  return parseCsv(raw).map((r): GraphNode => ({
    id:             r.id,
    name:           r.name,
    gender:         r.gender === 'Nữ' ? 'Nữ' : 'Nam',
    age:            Number(r.age),
    job:            r.job,
    city:           r.city,
    district:       r.district,
    province:       r.province,
    education:      r.education,
    workplace:      r.workplace,
    income_level:   r.income_level as GraphNode['income_level'],
    marital_status: r.marital_status as GraphNode['marital_status'],
    has_children:   r.has_children === 'true',
    nationality:    r.nationality,
    ethnic_group:   r.ethnic_group,
    religion:       r.religion,
    birth_year:     Number(r.birth_year),
    phone_prefix:   '',
    created_at:     r.created_at,
    confidence_score: Number(r.confidence_score),
    appearance: {
      age_range:   r.age_range   as GraphNode['appearance']['age_range'],
      skin_tone:   r.skin_tone   as GraphNode['appearance']['skin_tone'],
      hair_color:  r.hair_color  as GraphNode['appearance']['hair_color'],
      hair_style:  r.hair_style  as GraphNode['appearance']['hair_style'],
      glasses:     r.glasses     === 'true',
      facial_hair: r.facial_hair === 'true',
    },
  }));
}

// ── relations.csv → GraphEdge[] ──────────────────────────────────────────────

function loadEdges(): GraphEdge[] {
  const raw = readFileSync(join(__dirname, 'relations.csv'), 'utf-8');
  return parseCsv(raw).map((r, i): GraphEdge => ({
    id:   `e${String(i + 1).padStart(4, '0')}`,
    from: r.from_id,
    to:   r.to_id,
    type: r.relation_type as GraphEdge['type'],
  }));
}

// ── Exported singletons (loaded once at startup) ───────────────────────────────

export const ALL_NODES: GraphNode[] = loadNodes();
export const ALL_EDGES: GraphEdge[] = loadEdges();

export const ALL_GRAPH_DATA: GraphData = { nodes: ALL_NODES, edges: ALL_EDGES };

console.log(`[CsvLoader] Loaded ${ALL_NODES.length} nodes, ${ALL_EDGES.length} edges from CSV`);
