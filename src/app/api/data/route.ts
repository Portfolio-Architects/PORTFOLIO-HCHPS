import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Allowed sheets
const ALLOWED_SHEETS = new Set([
  'TASKS', 'MEETINGS', 'PROJECTS',
  'BUDGET_CATEGORIES', 'BUDGET_ENTRIES',
  'INVENTORY', 'STOCK_CHANGES',
  'SIGNAL_LOG', 'KNOWLEDGE',
  'MAP_CUSTOMIZATION',
  'PLANNING_MAP_CUSTOMIZATION',
  'DELETED_SIGNALS', 'GLOBAL_TOMBSTONES'
]);

function validateSheet(sheet: string): boolean {
  return ALLOWED_SHEETS.has(sheet) || sheet.startsWith('WIKI_DOC_');
}

function getFilePath(sheet: string): string {
  // Use process.cwd() so it works regardless of where the app is run from
  return path.join(process.cwd(), 'data', `${sheet}.json`);
}

async function readData(sheet: string): Promise<any[]> {
  const filePath = getFilePath(sheet);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    if (sheet === 'BUDGET_CATEGORIES') {
      console.log(`[API] Returning ${parsed.length} categories for BUDGET_CATEGORIES!`);
    }
    return parsed;
  } catch (err: any) {
    // If file doesn't exist, return empty array
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function backupDataFile(sheet: string, data: any[]): Promise<void> {
  try {
    const backupDir = path.join(process.cwd(), 'data', 'backups', sheet);
    await fs.mkdir(backupDir, { recursive: true });
    
    // ISO format suitable for filenames: YYYY-MM-DDTHH-mm-ss-SSSZ
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `${timestamp}_${sheet}.json`);
    
    await fs.writeFile(backupFile, JSON.stringify(data, null, 2), 'utf-8');
    
    // Prune old backups (keep only the 20 most recent)
    const files = await fs.readdir(backupDir);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort(); // Lexicographical sort works chronologically
    if (jsonFiles.length > 20) {
      const toDelete = jsonFiles.slice(0, jsonFiles.length - 20);
      for (const file of toDelete) {
        try {
          await fs.unlink(path.join(backupDir, file));
        } catch (unlinkErr) {
          console.error(`[Backup] Failed to prune backup file ${file}:`, unlinkErr);
        }
      }
    }
  } catch (backupErr) {
    console.error(`[Backup] Failed to backup sheet ${sheet}:`, backupErr);
  }
}

async function writeDataToFile(sheet: string, data: any[]): Promise<void> {
  const filePath = getFilePath(sheet);
  
  // Ensure the data directory exists
  const dirPath = path.dirname(filePath);
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (e) {}

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  
  // Trigger backup
  await backupDataFile(sheet, data);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sheet = searchParams.get('sheet');

  if (!sheet) {
    return NextResponse.json({ success: false, error: 'Missing sheet parameter' }, { status: 400 });
  }

  if (!validateSheet(sheet)) {
    return NextResponse.json({ success: false, error: 'Invalid sheet name' }, { status: 400 });
  }

  try {
    const data = await readData(sheet);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sheet, action, data, id } = body;

    if (!sheet || !action) {
      return NextResponse.json({ success: false, error: 'Missing sheet or action' }, { status: 400 });
    }

    if (!validateSheet(sheet)) {
      return NextResponse.json({ success: false, error: 'Invalid sheet name' }, { status: 400 });
    }

    let rows: any[] = [];
    if (action !== 'replace') {
      rows = await readData(sheet);
    }

    switch (action) {
      case 'add': {
        if (!data || Array.isArray(data)) {
          return NextResponse.json({ success: false, error: 'Invalid data for add' }, { status: 400 });
        }
        rows.push(data);
        break;
      }
      case 'update': {
        if (!id || !data || Array.isArray(data)) {
          return NextResponse.json({ success: false, error: 'Missing id or data for update' }, { status: 400 });
        }
        const idx = rows.findIndex((r: any) => r.id === id);
        if (idx === -1) {
          return NextResponse.json({ success: false, error: 'ID not found' }, { status: 404 });
        }
        rows[idx] = { ...rows[idx], ...data };
        break;
      }
      case 'delete': {
        if (!id) {
          return NextResponse.json({ success: false, error: 'Missing id for delete' }, { status: 400 });
        }
        const before = rows.length;
        rows = rows.filter((r: any) => r.id !== id);
        if (rows.length === before) {
          return NextResponse.json({ success: false, error: 'ID not found' }, { status: 404 });
        }
        break;
      }
      case 'replace': {
        rows = Array.isArray(data) ? data : [];
        break;
      }
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

    await writeDataToFile(sheet, rows);
    return NextResponse.json({ success: true });

  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
