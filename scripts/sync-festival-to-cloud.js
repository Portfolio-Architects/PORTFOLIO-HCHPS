/**
 * 2026 양재천 건강 페스티벌 로컬 SSOT ↔ Cloudflare Pages 24/7 레플리카 동기화 도구
 * 
 * 사용법: node scripts/sync-festival-to-cloud.js
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'FESTIVAL_YANGJAE_2026.json');
const CLOUDFLARE_URL = process.env.CLOUDFLARE_PAGES_URL || process.env.NEXT_PUBLIC_CLOUDFLARE_PAGES_URL || 'https://portfolio-hchps.pages.dev';

async function main() {
  console.log('🚀 ====================================================');
  console.log('🚀 Yangjae Festival: Syncing Local SSOT to Cloudflare...');
  console.log('🚀 ====================================================');

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ 로컬 데이터 파일이 존재하지 않습니다: ${DATA_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const payload = JSON.parse(raw);

  const target = `${CLOUDFLARE_URL.replace(/\/+$/, '')}/api/festival/yangjae`;
  console.log(`📡 대상 엔드포인트: ${target}`);

  const token = process.env.HCHPS_AUTH_TOKEN || '';
  const headers = {
    'Content-Type': 'application/json',
    'X-Sync-Source': 'local-ssot-dual-sync',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('🔐 HCHPS_AUTH_TOKEN 인증 헤더 탑재 완료');
  }

  try {
    const res = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json();
      console.log('🎉 [PASS] Cloudflare 24/7 Read-Only Replica 동기화 성공!');
      console.log('   ↳ 발행 시각:', json.publishedAt || new Date().toISOString());
      console.log(`   ↳ 24h 열람 URL: ${CLOUDFLARE_URL}/festival/yangjae`);
    } else {
      console.warn(`⚠️ Cloudflare 응답 코드: HTTP ${res.status}`);
      const text = await res.text();
      console.warn('   ↳ 응답 내용:', text);
    }
  } catch (err) {
    console.error('❌ Cloudflare 네트워크 전송 오류:', err.message);
  }
}

main();
