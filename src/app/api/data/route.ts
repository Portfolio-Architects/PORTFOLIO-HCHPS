import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getDomainSchema } from '@/lib/schemas';

// Allowed sheets
const ALLOWED_SHEETS = new Set([
  'TASKS', 'MEETINGS', 'PROJECTS',
  'BUDGET_CATEGORIES', 'BUDGET_ENTRIES',
  'INVENTORY', 'STOCK_CHANGES',
  'SIGNAL_LOG',
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

async function safeRename(src: string, dest: string, retries = 3, delay = 50): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fs.rename(src, dest);
      return;
    } catch (err: any) {
      // 윈도우 OS rename 완료 후 지연 응답으로 인한 ENOENT 우회: 목적 파일이 존재하면 성공 간주
      if (err.code === 'ENOENT') {
        try {
          await fs.access(dest);
          return;
        } catch (accessErr) {
          // dest가 존재하지 않는다면 진짜 누락이므로 다음 재시도 또는 fallback 진행
        }
      }

      if (attempt === retries) {
        try {
          await fs.copyFile(src, dest);
          await fs.unlink(src);
          return;
        } catch (fallbackErr) {
          console.error(`[File System] safeRename fallback failed after ${retries} attempts from ${src} to ${dest}:`, fallbackErr);
          throw err;
        }
      }
      
      // 파일 락이 풀리도록 대기 후 재시도
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
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
    await fs.mkdir(backupDir, { recursive: true });
    
    // ISO format suitable for filenames: YYYY-MM-DDTHH-mm-ss-SSSZ
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `${timestamp}_${sheet}.json`);
    
    // 원자적 파일 백업 쓰기
    const tmpBackupFile = `${backupFile}.tmp`;
    await fs.writeFile(tmpBackupFile, dataStr, 'utf-8');
    await safeRename(tmpBackupFile, backupFile);
    
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
    await fs.mkdir(dailyDir, { recursive: true });
    
    const dayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dailyFile = path.join(dailyDir, `${dayStr}_${sheet}.json`);
    
    const tmpDailyFile = `${dailyFile}.tmp`;
    await fs.writeFile(tmpDailyFile, dataStr, 'utf-8');
    await safeRename(tmpDailyFile, dailyFile);
    
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
    await fs.mkdir(weeklyDir, { recursive: true });
    
    const weekNo = getWeekNumber(now);
    const weekStr = `${now.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    const weeklyFile = path.join(weeklyDir, `${weekStr}_${sheet}.json`);
    
    const tmpWeeklyFile = `${weeklyFile}.tmp`;
    await fs.writeFile(tmpWeeklyFile, dataStr, 'utf-8');
    await safeRename(tmpWeeklyFile, weeklyFile);
    
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
  
  // Ensure the data directory exists
  const dirPath = path.dirname(filePath);
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (e) {}

  // 2. 원자적 파일 쓰기 (Write to .tmp first, then rename)
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await safeRename(tmpPath, filePath);
  
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
