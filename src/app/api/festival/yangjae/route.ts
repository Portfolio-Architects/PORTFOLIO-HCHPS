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
          'Cache-Control': 'no-cache, no-store, must-revalidate',
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

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    if (!payload || !payload.meta) {
      return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
    }

    // Ensure backups directory exists
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Auto backup before write
    if (fs.existsSync(DATA_FILE)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `FESTIVAL_YANGJAE_2026_${timestamp}.json`);
      fs.copyFileSync(DATA_FILE, backupPath);

      // Keep only latest 20 backups
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('FESTIVAL_YANGJAE_2026_'))
        .sort();
      while (files.length > 20) {
        const oldest = files.shift();
        if (oldest) fs.unlinkSync(path.join(backupDir, oldest));
      }
    }

    // Update lastUpdated timestamp
    payload.meta.lastUpdated = new Date().toISOString().split('T')[0];

    // Write to disk
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');

    return NextResponse.json({ success: true, message: 'Saved successfully', data: payload }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('[API /api/festival/yangjae] Error saving data:', error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}
