import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.txt', '.xlsx', '.xls', '.md', '.csv', '.json']);

// 바탕화면 경로 리스트 (바탕화면 및 사용자 환경 기본 바탕화면)
const scanPaths = [
  'd:\\Desktop',
  path.join(os.homedir(), 'Desktop'),
  'f:\\' // F 드라이브 루트
];

// 파일 고유 ID 생성 (경로 기반 MD5 해시)
function generateFileId(filePath: string): string {
  return crypto.createHash('md5').update(filePath).digest('hex');
}

// 비동기 디렉토리 스캔 함수 (안전성 및 극효율을 위해 깊이 제한 maxDepth=2 적용)
async function scanDirectory(dirPath: string, currentDepth = 1, maxDepth = 2): Promise<any[]> {
  const results: any[] = [];
  try {
    // 경로 존재 여부 및 디렉토리 여부 확인
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) return [];

    const files = await fs.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);

      // 시스템 파일이나 숨김 폴더는 건너뜀 (예: $RECYCLE.BIN, System Volume Information, .git 등)
      if (file.name.startsWith('$') || file.name.startsWith('.') || file.name === 'System Volume Information' || file.name === 'node_modules') {
        continue;
      }

      if (file.isDirectory()) {
        if (currentDepth < maxDepth) {
          const subResults = await scanDirectory(fullPath, currentDepth + 1, maxDepth);
          results.push(...subResults);
        }
      } else {
        const ext = path.extname(file.name).toLowerCase();
        if (ALLOWED_EXTENSIONS.has(ext)) {
          try {
            const fileStat = await fs.stat(fullPath);
            results.push({
              id: generateFileId(fullPath),
              name: file.name,
              path: fullPath,
              size: fileStat.size,
              lastModified: fileStat.mtime.toISOString(),
              layerId: 3 // 3: 위키/문서 레이어
            });
          } catch {
            // 개별 파일 읽기 오류는 무시 (파일 잠금 등)
          }
        }
      }
    }
  } catch {
    // 디렉토리가 없거나(예: F 드라이브 미마운트) 권한이 없는 경우 조용히 무시
  }
  return results;
}

export async function GET() {
  try {
    const allFilesMap = new Map<string, any>();

    for (const targetPath of scanPaths) {
      const files = await scanDirectory(targetPath, 1, 2);
      for (const file of files) {
        // 경로 기준 중복 제거
        allFilesMap.set(file.path, file);
      }
    }

    const fileList = Array.from(allFilesMap.values());
    return NextResponse.json({ success: true, data: fileList });
  } catch (e: any) {
    console.error('[Drive Scraper Error]', e);
    return NextResponse.json({ success: false, error: e.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json({ success: false, error: 'Missing filePath parameter' }, { status: 400 });
    }

    // 파일 존재 여부 검증
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ success: false, error: 'File not found on local disk' }, { status: 404 });
    }

    // 파이썬 극효율 파서 호출
    const pythonScript = path.join(process.cwd(), 'scripts', 'fast_parser.py');
    
    return new Promise<Response>((resolve) => {
      execFile('python', [pythonScript, filePath], { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[Fast Parser Process Error]', error, stderr);
          return resolve(NextResponse.json({ success: false, error: `Parser process error: ${error.message}` }, { status: 500 }));
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.success) {
            return resolve(NextResponse.json({ success: true, content: parsed.content }));
          } else {
            return resolve(NextResponse.json({ success: false, error: parsed.error }, { status: 500 }));
          }
        } catch (parseErr) {
          console.error('[Fast Parser Output Parsing Error]', stdout, parseErr);
          return resolve(NextResponse.json({ success: false, error: 'Failed to parse script output JSON' }, { status: 500 }));
        }
      });
    });

  } catch (e: any) {
    console.error('[Drive Parser Route Error]', e);
    return NextResponse.json({ success: false, error: e.message || 'Internal server error' }, { status: 500 });
  }
}
