import { NextResponse } from 'next/server';

type PickupType = 'burnable' | 'plastic' | 'cans' | 'bottles' | 'paper' | 'bulk';

type Schedule = {
  ward: string;
  station?: string;
  version: string; // ISO date
  pickups: { day: string; type: PickupType; notes?: string }[];
  bulkyFees?: { item: string; feeYen: number; notes?: string }[];
};

const decodeResponse = async (response: Response) => {
  const buffer = await response.arrayBuffer();
  try {
    return new TextDecoder('shift_jis').decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
};

const parseCsv = (csv: string) =>
  csv
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(',')
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0),
    )
    .filter((row) => row.length > 0);

const fetchDataset = async (query: string): Promise<Schedule> => {
  const searchUrl = 'https://catalog.data.metro.tokyo.lg.jp/api/3/action/package_search';
  const searchRes = await fetch(`${searchUrl}?q=${encodeURIComponent(query)}+収集日&rows=1`, {
    cache: 'no-store',
  });

  if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
  const searchJson = await searchRes.json();
  const pkg = searchJson?.result?.results?.[0];

  if (!pkg) throw new Error('No matching dataset found');

  const csvResource = pkg.resources?.find(
    (r: { format?: string; url?: string }) => r.format?.toLowerCase() === 'csv' && typeof r.url === 'string',
  );

  if (!csvResource) throw new Error('Dataset does not provide CSV data');

  const csvRes = await fetch(csvResource.url, { cache: 'no-store' });
  if (!csvRes.ok) throw new Error(`Download failed: ${csvRes.status}`);

  const csvText = await decodeResponse(csvRes);
  const rows = parseCsv(csvText);

  const pickups = rows.slice(1, 8).map((row, index) => ({
    day: row[0] || `Row ${index + 1}`,
    type: 'burnable' as PickupType,
    notes: row.slice(1).join(' ・ '),
  }));

  return {
    ward: pkg.title || query,
    version: pkg.metadata_modified || pkg.metadata_created || 'unknown',
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
