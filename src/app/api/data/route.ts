import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getDomainSchema } from '@/lib/schemas';
import { startWatcherDaemon } from '@/lib/engine/watcher';

// 백엔드 데몬 가동
if (typeof window === 'undefined') {
  startWatcherDaemon().catch(err => {
    console.error('[Watcher Daemon Initialization Error]', err);
  });
}

// Allowed sheets
const ALLOWED_SHEETS = new Set([
  'TASKS', 'MEETINGS', 'PROJECTS',
  'BUDGET_CATEGORIES', 'BUDGET_ENTRIES',
  'INVENTORY', 'STOCK_CHANGES',
  'SIGNAL_LOG',
  'MAP_CUSTOMIZATION',
  'PLANNING_MAP_CUSTOMIZATION',
  'DELETED_SIGNALS', 'GLOBAL_TOMBSTONES',
  'EXTERNAL_DOCS',
  'CLASSIFICATION_WORDS'
]);

function validateSheet(sheet: string): boolean {
  return ALLOWED_SHEETS.has(sheet) || sheet.startsWith('WIKI_DOC_');
}

function getFilePath(sheet: string): string {
  // Use process.cwd() so it works regardless of where the app is run from
  return path.join(process.cwd(), 'data', `${sheet}.json`);
}

async function safeWriteFile(filePath: string, dataStr: string, retries = 5, delay = 50): Promise<void> {
  const dirPath = path.dirname(filePath);
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (e) {}

  // 1. Windows file-lock collisions isolated using unique temp files per write request
  const tempFilePath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fs.writeFile(tempFilePath, dataStr, 'utf-8');
      
      // Retry loop specifically for renaming, in case files are briefly locked by read streams
      let renamed = false;
      for (let renameAttempt = 1; renameAttempt <= 3; renameAttempt++) {
        try {
          await fs.rename(tempFilePath, filePath);
          renamed = true;
          break;
        } catch (renameErr) {
          if (renameAttempt === 3) throw renameErr;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      if (renamed) return;
    } catch (err: any) {
      try {
        await fs.unlink(tempFilePath);
      } catch {}

      if (attempt === retries) {
        console.error(`[File System] Write failed after ${retries} attempts for path ${filePath}:`, err);
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function safeReadFile(filePath: string, retries = 5, delay = 50): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw err;
      }
      if (attempt === retries) {
        console.error(`[File System] Read failed after ${retries} attempts for path ${filePath}:`, err);
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`[File System] Read failed for path ${filePath}`);
}

async function readData(sheet: string, retries = 5, delay = 50): Promise<any[]> {
  const filePath = getFilePath(sheet);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const data = await safeReadFile(filePath);
      // Empty string denotes split-second read during file truncation. Force retry.
      if (!data.trim()) {
        throw new Error('File is empty');
      }
      const parsed = JSON.parse(data);
      if (sheet === 'BUDGET_CATEGORIES') {
        console.log(`[API] Returning ${parsed.length} categories for BUDGET_CATEGORIES!`);
      }
      return parsed;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      // If parsing fails due to incomplete writes (SyntaxError) or empty file, wait and retry.
      if (attempt === retries) {
        console.error(`[API] Read parsed failed for ${sheet} after ${retries} attempts:`, err);
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`[API] Read parsed failed for ${sheet}`);
}

// ISO 주차(Week Number) 구하기 함수
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

// Zod 스키마 게이트키퍼 유효성 검증 함수
function validateDataPayload(sheet: string, data: any[]): boolean {
  const schema = getDomainSchema(sheet);
  
  if (schema && typeof (schema as any).safeParse === 'function') {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const parsed = (schema as any).safeParse(item);
      if (!parsed.success) {
        console.error(`[Zod Gatekeeper Error] Invalid data item in sheet ${sheet} at index ${i}:`, parsed.error.format());
        return false;
      }
    }
  }
  return true;
}

async function backupDataFile(sheet: string, data: any[]): Promise<void> {
  try {
    const dataStr = JSON.stringify(data, null, 2);
    const now = new Date();

    // 1. Son 백업 (최근 20개 변경 이력)
    const backupDir = path.join(process.cwd(), 'data', 'backups', sheet);
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `${timestamp}_${sheet}.json`);
    
    // 직접 안전 파일 쓰기
    await safeWriteFile(backupFile, dataStr);
    
    // Prune old backups (keep only the 20 most recent)
    const files = await fs.readdir(backupDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).sort(); // Lexicographical sort works chronologically
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

    // 2. Father 백업 (일별 아카이브 - 최대 7일 보존)
    const dailyDir = path.join(process.cwd(), 'data', 'backups', 'daily', sheet);
    const dayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dailyFile = path.join(dailyDir, `${dayStr}_${sheet}.json`);
    
    await safeWriteFile(dailyFile, dataStr);
    
    const dailyFiles = (await fs.readdir(dailyDir)).filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).sort();
    if (dailyFiles.length > 7) {
      const toDelete = dailyFiles.slice(0, dailyFiles.length - 7);
      for (const file of toDelete) {
        try {
          await fs.unlink(path.join(dailyDir, file));
        } catch (err) {
          console.error(`[Backup] Pruning Daily failed for ${file}:`, err);
        }
      }
    }

    // 3. Grandfather 백업 (주별 아카이브 - 최대 4주 보존)
    const weeklyDir = path.join(process.cwd(), 'data', 'backups', 'weekly', sheet);
    const weekNo = getWeekNumber(now);
    const weekStr = `${now.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    const weeklyFile = path.join(weeklyDir, `${weekStr}_${sheet}.json`);
    
    await safeWriteFile(weeklyFile, dataStr);
    
    const weeklyFiles = (await fs.readdir(weeklyDir)).filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).sort();
    if (weeklyFiles.length > 4) {
      const toDelete = weeklyFiles.slice(0, weeklyFiles.length - 4);
      for (const file of toDelete) {
        try {
          await fs.unlink(path.join(weeklyDir, file));
        } catch (err) {
          console.error(`[Backup] Pruning Weekly failed for ${file}:`, err);
        }
      }
    }

  } catch (backupErr) {
    console.error(`[Backup] Failed to backup sheet ${sheet}:`, backupErr);
  }
}

async function writeDataToFile(sheet: string, data: any[]): Promise<void> {
  // 1. Zod 유효성 검사 적용 (무결성 깨진 데이터 디스크 쓰기 방지)
  if (!validateDataPayload(sheet, data)) {
    throw new Error(`[Zod validation failed] Data structure is invalid for sheet: ${sheet}`);
  }

  const filePath = getFilePath(sheet);
  const dataStr = JSON.stringify(data, null, 2);
  
  // 2. 직접 안전 파일 쓰기 (재시도 및 지연 내장)
  await safeWriteFile(filePath, dataStr);
  
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
    console.error(`[API GET Error] Failed to read data for sheet ${sheet}:`, e);
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
