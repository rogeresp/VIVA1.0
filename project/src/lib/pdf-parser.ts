const CATS = ['Apartamento', 'Casa', 'Terreno', 'Sala Comercial', 'Outros'] as const;
const RE_PHONE = /\(\d{2}\)\s*\d{4,5}-?\d{4}/;
const RE_VALUE = /^\d{1,3}(\.\d{3})*,\d{2}$/;
const RE_REF_AT_LINE = /^(\d{4,6})\s+(\d{1,2})\s+(.+)$/;

export interface ParsedProperty {
  property_type: string;
  category: string;
  status: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  complement: string;
  private_area: number;
  bedrooms: number;
  suites: number;
  garages: number;
  sale_price: number;
  description: string;
  owner_name: string;
  owner_phone: string;
  building_name: string;
  ref: string;
}

export async function extractTextLines(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${(pdfjs as any).version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const allLines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items as Array<{ str: string; transform: number[] }>) {
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x, s: it.str });
    }
    const ys = [...rows.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const line = rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((i) => i.s)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) allLines.push(line);
    }
  }
  return allLines;
}

export function parsePropertiesFromLines(lines: string[]): ParsedProperty[] {
  const blocks: string[][] = [];
  let cur: string[] = [];
  const isHeader = (l: string) =>
    /^Relatório de Imóveis$/.test(l) ||
    /^Imobiliária:/.test(l) ||
    /^Corretor:/.test(l) ||
    /^Ref\.\s+Categoria/.test(l) ||
    /^Página \d+ de \d+/.test(l) ||
    /^https?:\/\//.test(l) ||
    /^\d{2}\/\d{2}\/\d{4}/.test(l);

  for (const raw of lines) {
    const l = raw.trim();
    if (!l || isHeader(l)) continue;
    if (CATS.some((c) => l.startsWith(c)) || /^\d{4,6}\s+(Apartamento|Casa|Terreno|Sala Comercial|Outros)/.test(l)) {
      if (cur.length) blocks.push(cur);
      cur = [l];
    } else {
      cur.push(l);
    }
  }
  if (cur.length) blocks.push(cur);

  const results: ParsedProperty[] = [];
  for (const b of blocks) {
    const p = parseBlock(b);
    if (p) results.push(p);
  }
  return results;
}

function parseBRL(v: string): number {
  return Number(v.replace(/\./g, '').replace(',', '.'));
}

function parseBlock(lines: string[]): ParsedProperty | null {
  if (!lines.length) return null;

  // Line 0: "13179 Apartamento" → ref=13179, type=apartamento
  let ref = '';
  let property_type = 'outros';
  const firstPart = lines[0].trim().split(/\s+/);
  if (firstPart.length >= 2) {
    const code = firstPart[0];
    if (/^\d+$/.test(code)) {
      ref = code;
    }
    const typeName = firstPart.slice(1).join(' ');
    for (const c of CATS) {
      if (typeName.startsWith(c)) {
        property_type = c === 'Apartamento' ? 'apartamento' :
          c === 'Casa' ? 'casa' :
          c === 'Terreno' ? 'terreno' :
          c === 'Sala Comercial' ? 'sala_comercial' : 'outros';
        break;
      }
    }
  } else {
    // Try the old way
    for (const c of CATS) {
      if (lines[0].startsWith(c)) {
        property_type = c === 'Apartamento' ? 'apartamento' :
          c === 'Casa' ? 'casa' :
          c === 'Terreno' ? 'terreno' :
          c === 'Sala Comercial' ? 'sala_comercial' : 'outros';
        break;
      }
    }
    for (const l of lines) {
      const m = l.match(/^(\d{4,6})\s+(\d{1,2})\b/);
      if (m) { ref = m[1]; break; }
    }
  }
  if (!ref) return null;

  let bedrooms = 0;
  let suites = 0;
  const dormLine = lines.find((l) => /Dormit/i.test(l));
  if (dormLine) {
    const nums = dormLine.match(/\d+/g);
    if (nums) {
      bedrooms = Number(nums[0]) || 0;
      suites = Number(nums[1]) || 0;
    }
  }

  let garages = 0;
  let private_area = 0;
  // Look for "XX / XX" pattern (area: total / private)
  for (const l of lines) {
    const m = l.match(/^(\d{3,5})\s*\/\s*(\d{3,5})$/);
    if (m) {
      private_area = Number(m[2]) || 0;
      break;
    }
  }

  let owner_phone = '';
  let owner_name = '';

  // Try to find owner by Proprietário: label first
  for (const l of lines) {
    const pm = l.match(/Propriet[áa]rio:?\s*(.+)/i);
    if (pm && pm[1].trim().length > 2) {
      owner_name = pm[1].trim();
      break;
    }
  }

  // Find phone number
  for (const l of lines) {
    const pm = l.match(RE_PHONE);
    if (pm) {
      owner_phone = pm[0];
      break;
    }
  }

  // If no name found yet, try heuristic near phone number
  if (!owner_name) {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(RE_PHONE);
      if (m) {
        if (!owner_phone) owner_phone = m[0];
        for (let j = i; j >= Math.max(0, i - 4); j--) {
          const cand = lines[j].replace(RE_PHONE, '').replace(/\[V\]/g, '').trim();
          if (
            cand &&
            !RE_VALUE.test(cand) &&
            !/Quadra|Lote|Dormit|Chaves|^\d/.test(cand) &&
            !CATS.some((c) => cand.startsWith(c)) &&
            /[A-Za-zÀ-ú]/.test(cand) &&
            cand.length < 60
          ) {
            const seg = cand.split('|').pop()!.trim();
            if (seg && /[A-Za-zÀ-ú]/.test(seg)) {
              owner_name = seg;
              break;
            }
          }
        }
        break;
      }
    }
  }

  // Last resort: try to find a name-like line early in the block
  if (!owner_name) {
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const cand = lines[i].trim();
      if (
        cand.length > 3 &&
        cand.length < 60 &&
        /^[A-ZÀ-Ú][a-zà-úA-ZÀ-Ú\s.]+$/.test(cand) &&
        !/\d/.test(cand) &&
        !/Quadra|Lote|Dormit|Chaves|Rua|Av\.|Avenida/i.test(cand) &&
        !CATS.some((c) => cand.startsWith(c))
      ) {
        owner_name = cand;
        break;
      }
    }
  }

  const valores: number[] = [];
  for (const l of lines) {
    const matches = l.match(/\d{1,3}(\.\d{3})*,\d{2}/g);
    if (matches) for (const v of matches) valores.push(parseBRL(v));
  }
  const sale_price = valores[0] || 0;

  // Detect building name early so we can exclude it from address
  let building_name = '';
  // Try explicit label: Edifício / Condomínio / Bloco / Torre
  for (const l of lines) {
    const m = l.match(/(?:Edif[íi]cio|Condom[ií]nio|Ed|Bloco|Torre)[:\s]*([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s.'\-]+)/i);
    if (m && m[1].trim().length > 2) {
      building_name = m[1].trim();
      break;
    }
  }
  // Fallback: line right after Dormitórios is often the building name
  if (!building_name) {
    const dormIdx = lines.findIndex(l => /Dormit/i.test(l));
    if (dormIdx >= 0 && dormIdx + 1 < lines.length) {
      const cand = lines[dormIdx + 1].trim();
      if (
        cand.length > 2 && cand.length < 60 &&
        !/^\d/.test(cand) && !RE_PHONE.test(cand) &&
        !RE_VALUE.test(cand) &&
        !/Quadra|Lote|Rua|Av\.|Avenida|Chaves|\[V\]|Dormit/i.test(cand) &&
        /[A-Za-zÀ-ú]/.test(cand)
      ) {
        building_name = cand;
      }
    }
  }

  const enderecoLines: string[] = [];
  for (const l of lines) {
    const clean = l.trim();
    if (!clean) continue;
    if (building_name && clean === building_name) continue;
    if (owner_name && (clean === owner_name || clean.startsWith(owner_name + ' - '))) continue;
    if (ref && clean.startsWith(ref)) continue;
    if (/^\d{3,5}\s*\/\s*\d{3,5}$/.test(clean)) continue;
    if (RE_PHONE.test(clean)) continue;
    if (/Chaves:/i.test(clean)) continue;
    if (/Dormit/i.test(clean)) continue;
    if (/^Quadra:?$|^Lote:?$|^Quadra:|^Lote:/i.test(clean)) continue;
    if (CATS.some((c) => clean.startsWith(c))) continue;
    if (RE_REF_AT_LINE.test(clean)) {
      const rem = clean.replace(/^\d{4,6}\s+\d{1,2}\s*/, '').replace(/\d{1,3}(\.\d{3})*,\d{2}/g, '').replace(/\[V\]/g, '').replace(/\|/g, '').trim();
      if (rem && /[A-Za-zÀ-ú]/.test(rem)) enderecoLines.push(rem);
      continue;
    }
    if (RE_VALUE.test(clean)) continue;
    if (/^\d{1,3}(\.\d{3})*,\d{2}/.test(clean)) continue;
    if (/^\[V\]/.test(clean)) continue;
    enderecoLines.push(clean.replace(/\[V\]/g, '').replace(/\|/g, '').trim());
  }

  let neighborhood = '';
  let city = '';
  for (let i = enderecoLines.length - 1; i >= 0; i--) {
    if (/ - /.test(enderecoLines[i]) || /Capão|Centro|Zona |Bairro/i.test(enderecoLines[i])) {
      const parts = enderecoLines[i].split(' - ');
      const first = parts[0].trim();
      const rest = parts.slice(1).join(' - ').trim();
      if (building_name && first.toLowerCase() === building_name.toLowerCase()) {
        neighborhood = '';
        city = rest || first;
      } else {
        neighborhood = first;
        city = rest;
      }
      enderecoLines.splice(i, enderecoLines.length - i);
      break;
    }
  }

  let number = '';
  let complement = '';
  for (let i = 0; i < enderecoLines.length; i++) {
    // Try standalone "NÚMERO / COMPLEMENTO" line
    const m = enderecoLines[i].match(/^(\d+[A-Za-z]?)\s*\/\s*(\d+[A-Za-z]?)$/);
    if (m) {
      number = m[1];
      complement = m[2];
      enderecoLines.splice(i, 1);
      break;
    }
    // Try standalone "NÚMERO" line
    const m2 = enderecoLines[i].match(/^(\d+[A-Za-z]?)$/);
    if (m2 && !number) {
      number = m2[1];
      enderecoLines.splice(i, 1);
      break;
    }
  }

  let street = '';
  const restante = enderecoLines.filter((l) => l.length > 0);
  let logIdx = restante.findIndex((l) => /,\s*$/.test(l) || /^(Rua|Av\.?|Avenida|Estrada|Rod\.?|Travessa|Alameda)/i.test(l));
  if (logIdx >= 0) {
    let raw = restante[logIdx];
    // Try to extract number + complement from same line: "Rua Nome, 123 / 456" or "Rua Nome, 123"
    const numMatch = raw.match(/^(.*?),\s*(\d+[A-Za-z]?)(?:\s*\/\s*(\d+[A-Za-z]?))?$/);
    if (numMatch) {
      street = numMatch[1].replace(/,\s*$/, '').trim();
      if (numMatch[2] && !number) number = numMatch[2];
      if (numMatch[3] && !complement) complement = numMatch[3];
    } else {
      street = raw.replace(/,\s*$/, '').trim();
    }
    restante.splice(logIdx, 1);
  }
  if (restante.length >= 1 && !street) {
    street = restante.join(' ');
  }

  const status = lines.some((l) => /Suspenso/i.test(l)) ? 'suspenso' : 'disponivel';

  return {
    ref,
    property_type,
    category: 'venda',
    status,
    city,
    neighborhood,
    street,
    number,
    complement,
    private_area,
    bedrooms,
    suites,
    garages,
    sale_price,
    description: '',
    owner_name,
    owner_phone,
    building_name,
  };
}
