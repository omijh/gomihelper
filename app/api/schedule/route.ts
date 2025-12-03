import { NextResponse } from 'next/server';
import { read, utils } from 'xlsx';

type PickupType = 'burnable' | 'plastic' | 'cans' | 'bottles' | 'paper' | 'bulk';

type Schedule = {
  ward: string;
  station?: string;
  version: string; // ISO date
  pickups: { day: string; type: PickupType; notes?: string }[];
  bulkyFees?: { item: string; feeYen: number; notes?: string }[];
};

type Resource = {
  format?: string;
  url?: string;
  name?: string;
  last_modified?: string;
  created?: string;
};

type Package = {
  title?: string;
  metadata_modified?: string;
  metadata_created?: string;
  resources?: Resource[];
};

const decodeResponse = async (response: Response) => {
  const buffer = await response.arrayBuffer();
  try {
    return new TextDecoder('shift_jis').decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
};

const parseCsv = (csv: string) => {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];

    if (inQuotes) {
      if (char === '"' && csv[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      current.push(field.trim());
      field = '';
    } else if (char === '\n') {
      current.push(field.trim());
      if (current.some((cell) => cell.length > 0)) rows.push(current);
      current = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field.trim());
    if (current.some((cell) => cell.length > 0)) rows.push(current);
  }

  return rows;
};

const parseXlsx = (buffer: ArrayBuffer) => {
  const workbook = read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });
  return rows
    .map((row) => row.map((cell) => (cell ?? '').toString().trim()))
    .filter((row) => row.some((cell) => cell.length > 0));
};

const classifyType = (header: string, cell: string): PickupType => {
  const text = `${header} ${cell}`.toLowerCase();

  if (/可燃|燃える|burnable|combustible/.test(text)) return 'burnable';
  if (/不燃|燃やさない|ceramic|metal/.test(text)) return 'bulk';
  if (/プラ|plastic|容器|包装/.test(text)) return 'plastic';
  if (/缶|かん|can/.test(text)) return 'cans';
  if (/びん|瓶|bottle/.test(text)) return 'bottles';
  if (/紙|古紙|新聞|雑誌|段ボール|paper/.test(text)) return 'paper';
  if (/粗大|大型/.test(text)) return 'bulk';
  return 'burnable';
};

const rowsToPickups = (rows: string[][]): Schedule['pickups'] => {
  if (!rows.length) return [];
  const [headers, ...body] = rows;
  const pickups: Schedule['pickups'] = [];

  body.forEach((row, rowIndex) => {
    const day = row[0]?.trim() || headers[0]?.trim() || `Row ${rowIndex + 1}`;

    row.forEach((cell, colIndex) => {
      if (colIndex === 0) return;
      const value = cell?.trim();
      if (!value) return;
      const header = headers[colIndex]?.trim() || `Column ${colIndex + 1}`;

      pickups.push({
        day,
        type: classifyType(header, value),
        notes: `${header}: ${value}`,
      });
    });
  });

  return pickups;
};

const pickResource = (resources: Resource[] = []) => {
  const normalized = resources.filter((r) => typeof r.url === 'string' && r.url.length > 0);
  const csv = normalized.find((r) => r.format?.toLowerCase() === 'csv');
  if (csv) return { resource: csv, kind: 'csv' as const };
  const xlsx = normalized.find((r) => ['xlsx', 'xls'].includes((r.format || '').toLowerCase()));
  if (xlsx) return { resource: xlsx, kind: 'excel' as const };
  return null;
};

const fetchDataset = async (query: string): Promise<Schedule> => {
  const searchUrl = 'https://catalog.data.metro.tokyo.lg.jp/api/3/action/package_search';
  const searchRes = await fetch(`${searchUrl}?q=${encodeURIComponent(query)}+収集日&fq=title:収集日&rows=5`, {
    cache: 'no-store',
  });

  if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
  const searchJson = await searchRes.json();
  const pkg: Package | undefined = searchJson?.result?.results?.find(
    (candidate: Package) => candidate.title && candidate.title.includes('収集'),
  ) || searchJson?.result?.results?.[0];

  if (!pkg) throw new Error('No matching dataset found');

  const picked = pickResource(pkg.resources);
  if (!picked) throw new Error('Dataset does not provide CSV or Excel data');

  const csvRes = await fetch(picked.resource.url as string, { cache: 'no-store' });
  if (!csvRes.ok) throw new Error(`Download failed: ${csvRes.status}`);

  const rows =
    picked.kind === 'excel'
      ? parseXlsx(await csvRes.arrayBuffer())
      : parseCsv(await decodeResponse(csvRes));

  const pickups = rowsToPickups(rows);

  return {
    ward: pkg.title || query,
    version: picked.resource.last_modified || pkg.metadata_modified || pkg.metadata_created || 'unknown',
    pickups: pickups.length
      ? pickups
      : [
          {
            day: '—',
            type: 'bulk',
            notes: 'No pickup rows found in dataset.',
          },
        ],
  };
};

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  try {
    const schedule = await fetchDataset(query);
    return NextResponse.json({ schedule });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
};
