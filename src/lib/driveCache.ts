import fs from 'fs';
import path from 'path';

export interface DriveSearchResult {
  fileName: string;
  relPath: string;
  fullPath: string;
  count: number;
  snippets: { pos: number; snippet: string }[];
}

interface CacheItem {
  mtime: number;
  size: number;
  content: string;
}

type CacheData = Record<string, CacheItem>;

const CACHE_PATH = 'F:\\부엉이_정리됨\\.search_cache.json';

class DriveCacheManager {
  private cache: CacheData = {};
  private isLoaded: boolean = false;

  constructor() {
    this.loadCache();
  }

  /**
   * 디스크에서 캐시 데이터를 1회 동기식 로드하여 메모리에 적재
   */
  public loadCache() {
    try {
      if (fs.existsSync(CACHE_PATH)) {
        const fileContent = fs.readFileSync(CACHE_PATH, 'utf-8');
        this.cache = JSON.parse(fileContent);
        this.isLoaded = true;
        console.log(`[DriveCache] ${Object.keys(this.cache).length}개 문서 본문 캐시를 메모리에 로드 완료.`);
      } else {
        console.log('[DriveCache] 캐시 파일이 존재하지 않습니다. 빈 캐시로 대기합니다.');
        this.cache = {};
        this.isLoaded = false;
      }
    } catch (error) {
      console.error('[DriveCache] 캐시 데이터 로드 중 오류 발생:', error);
      this.cache = {};
      this.isLoaded = false;
    }
  }

  /**
   * 메모리에 로드된 캐시를 강제 리프레시 (정비 스크립트 실행 후 캐시 동기화용)
   */
  public refreshCache() {
    this.loadCache();
  }

  /**
   * 메모리에 적재된 텍스트 맵을 상대로 V8 Regex 룩업을 직접 수행 (밀리초 단위 응답)
   */
  public searchCache(query: string, searchRoot: string = 'F:\\부엉이_정리됨'): DriveSearchResult[] {
    if (!query) return [];
    if (!this.isLoaded || Object.keys(this.cache).length === 0) {
      // 캐시가 없으면 단 1회 강제 로드 시도
      this.loadCache();
    }

    const results: DriveSearchResult[] = [];
    // 특수문자 이스케이프 처리
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'gi');

    for (const [fullPath, item] of Object.entries(this.cache)) {
      const content = item.content || '';
      if (!content) continue;

      // 정규식 매칭
      regex.lastIndex = 0;
      let match;
      const snippets: { pos: number; snippet: string }[] = [];
      let count = 0;

      while ((match = regex.exec(content)) !== null) {
        count++;
        // 최대 5개의 스니펫만 안전 수합
        if (snippets.length < 5) {
          const start = Math.max(0, match.index - 60);
          const end = Math.min(content.length, match.index + query.length + 60);
          const snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();
          snippets.push({
            pos: match.index,
            snippet: `... ${snippet} ...`
          });
        }
      }

      if (count > 0) {
        const fileName = path.basename(fullPath);
        const relPath = path.relative(searchRoot, fullPath);
        results.push({
          fileName,
          relPath,
          fullPath,
          count,
          snippets
        });
      }
    }

    // 매칭 빈도가 많은 순으로 정렬하여 반환
    return results.sort((a, b) => b.count - a.count);
  }
}

// Next.js Hot Reload 시 싱글톤 상태 유실 방지 전역 바인딩
const globalWithCache = global as typeof globalThis & {
  driveCacheInstance?: DriveCacheManager;
};

if (!globalWithCache.driveCacheInstance) {
  globalWithCache.driveCacheInstance = new DriveCacheManager();
}

export const driveCache = globalWithCache.driveCacheInstance;
