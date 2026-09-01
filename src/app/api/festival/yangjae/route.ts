import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_FILE = path.join(process.cwd(), 'data', 'FESTIVAL_YANGJAE_2026.json');

export async function GET() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return NextResponse.json(data, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    return NextResponse.json({ error: 'Festival data not found' }, { status: 404 });
  } catch (error) {
    console.error('[API /api/festival/yangjae] Error reading data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
