import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { webcrypto } from 'crypto';

const PIN = '0509';
const CRYPTO_SALT = new TextEncoder().encode('HCHPS-E2EE-SALT');

let cachedMasterKey: CryptoKey | null = null;

async function getMasterKey() {
  if (cachedMasterKey) return cachedMasterKey;
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(PIN),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  cachedMasterKey = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: CRYPTO_SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return cachedMasterKey;
}

async function decryptData(encryptedBase64: string): Promise<any> {
  try {
    const masterKey = await getMasterKey();
    const payloadBuffer = Buffer.from(encryptedBase64, 'base64');
    const iv = payloadBuffer.subarray(0, 12);
    const ciphertext = payloadBuffer.subarray(12);
    
    const decryptedBuffer = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer));
  } catch (e) {
    console.error('[Logs API] Decrypt failed:', e);
    return null;
  }
}

async function getBackupStats() {
  let sonCount = 0;
  let fatherCount = 0;
  let grandfatherCount = 0;

  const baseDir = path.join(process.cwd(), 'data', 'backups');
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'daily' && entry.name !== 'weekly') {
        const subFiles = await fs.readdir(path.join(baseDir, entry.name));
        sonCount += subFiles.filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).length;
      }
    }

    const dailyDir = path.join(baseDir, 'daily');
    try {
      const dailyEntries = await fs.readdir(dailyDir, { withFileTypes: true });
      for (const entry of dailyEntries) {
        if (entry.isDirectory()) {
          const subFiles = await fs.readdir(path.join(dailyDir, entry.name));
          fatherCount += subFiles.filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).length;
        }
      }
    } catch {}

    const weeklyDir = path.join(baseDir, 'weekly');
    try {
      const weeklyEntries = await fs.readdir(weeklyDir, { withFileTypes: true });
      for (const entry of weeklyEntries) {
        if (entry.isDirectory()) {
          const subFiles = await fs.readdir(path.join(weeklyDir, entry.name));
          grandfatherCount += subFiles.filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).length;
        }
      }
    } catch {}
  } catch {}

  return {
    son: sonCount,
    father: fatherCount,
    grandfather: grandfatherCount,
    total: sonCount + fatherCount + grandfatherCount
  };
}

export async function GET() {
  try {
    const logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = [];

    // 1. Next.js status & System Environment log entries
    const memUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[VITAL Daemon] Next.js dev server listening on port 3001. Heap: ${memUsage}MB.`
    });
    logs.push({
      timestamp: new Date(Date.now() - 2000).toISOString(),
      level: 'info',
      message: `[Watcher Daemon] Disabled file auto-parsing daemon (Manual mindmap mode active).`
    });

    // 2. Read diagnose report
    const diagnosePath = path.join(process.cwd(), 'data', 'diagnose_report.json');
    try {
      const diagRaw = await fs.readFile(diagnosePath, 'utf-8');
      const diagData = JSON.parse(diagRaw);
      const diagTime = diagData.timestamp || new Date().toISOString();
      const warnCount = diagData.summary?.totalWarnings || 0;
      
      logs.push({
        timestamp: diagTime,
        level: warnCount > 0 ? 'warn' : 'info',
        message: `[Lint check] Compiled code syntax check. Warnings: ${warnCount}, Architectural Violations: ${diagData.summary?.totalViolations || 0}, Bottlenecks: ${diagData.summary?.totalBottlenecks || 0}.`
      });
    } catch {}

    // 3. Read watcher history
    const historyPath = path.join(process.cwd(), 'data', 'WATCHER_HISTORY.json');
    try {
      const histRaw = await fs.readFile(historyPath, 'utf-8');
      const parsed = JSON.parse(histRaw);
      if (parsed && parsed[0] && parsed[0]._enc) {
        const decryptedHistory = await decryptData(parsed[0]._enc);
        if (decryptedHistory) {
          const files = Object.keys(decryptedHistory);
          files.forEach((file, index) => {
            const fileMeta = decryptedHistory[file];
            const displayPath = path.basename(file);
            // Stagger timestamps slightly for nice sorting
            const itemTime = new Date(fileMeta.mtime || (Date.now() - (index * 60000))).toISOString();
            
            logs.push({
              timestamp: itemTime,
              level: 'info',
              message: `[File Scanner] Detected file scanned & synced: ${displayPath} (Size: ${(fileMeta.size / 1024).toFixed(1)} KB)`
            });
          });
        }
      }
    } catch (e: any) {
      console.warn('[Logs API] Watcher history reading skipped:', e?.message || e);
    }

    // Sort logs ascending by timestamp (chronological order)
    const sortedLogs = logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const backupStats = await getBackupStats();

    return NextResponse.json({
      success: true,
      data: sortedLogs,
      daemonActive: false,
      watchDir: 'd:/Desktop',
      serverHeapMB: memUsage,
      backupStats
    });

  } catch (err: any) {
    console.error('[Logs API] Error fetching execution logs:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
