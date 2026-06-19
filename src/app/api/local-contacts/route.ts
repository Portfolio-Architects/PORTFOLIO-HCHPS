import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nodeId, nodeLabel, phones = [], emails = [], contacts = [] } = body;

    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, 'local_contacts.txt');

    // Ensure data directory exists
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch {}

    // Formatted timestamp
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;

    // Read existing file content if it exists to prevent duplicates
    let fileContent = '';
    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch {}

    let lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

    if (Array.isArray(contacts) && contacts.length > 0) {
      // Batch mode: filter out existing logs for the nodes being updated
      const nodeIdsToReplace = new Set(contacts.map(c => c.nodeId));
      lines = lines.filter(line => {
        const match = line.match(/노드 ID: ([^\s|]+)/);
        if (match && match[1]) {
          return !nodeIdsToReplace.has(match[1]);
        }
        return true;
      });

      // Append new records
      for (const contact of contacts) {
        const { nodeId: cid, nodeLabel: clabel, phones: cphones = [], emails: cemails = [] } = contact;
        if (!cid) continue;
        const phonesStr = cphones.length > 0 ? cphones.join(', ') : '없음';
        const emailsStr = cemails.length > 0 ? cemails.join(', ') : '없음';
        lines.push(`[${timestamp}] 노드 ID: ${cid} | 노드명: ${clabel || '이름없음'} | 연락처: ${phonesStr} | 이메일: ${emailsStr}`);
      }
    } else {
      // Single mode: filter out the specific nodeId if it exists
      if (!nodeId) {
        return NextResponse.json({ success: false, error: 'Missing nodeId' }, { status: 400 });
      }

      lines = lines.filter(line => {
        const match = line.match(/노드 ID: ([^\s|]+)/);
        if (match && match[1]) {
          return match[1] !== nodeId;
        }
        return true;
      });

      const phonesStr = phones.length > 0 ? phones.join(', ') : '없음';
      const emailsStr = emails.length > 0 ? emails.join(', ') : '없음';
      lines.push(`[${timestamp}] 노드 ID: ${nodeId} | 노드명: ${nodeLabel || '이름없음'} | 연락처: ${phonesStr} | 이메일: ${emailsStr}`);
    }

    const newContent = lines.join('\n') + '\n';

    // Write file with retry in case of Windows file locking
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await fs.writeFile(filePath, newContent, 'utf-8');
        break;
      } catch (err) {
        if (attempt === 5) throw err;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API local-contacts POST Error]', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
