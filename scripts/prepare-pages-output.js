const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');
const outDir = path.join(baseDir, 'out');
const publicDir = path.join(baseDir, 'public');
const dataFile = path.join(baseDir, 'data', 'FESTIVAL_YANGJAE_2026.json');
const templateFile = path.join(__dirname, 'pages-template.html');

const festivalData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const meta = festivalData.meta || {};
let template = fs.readFileSync(templateFile, 'utf8');

template = template.replace('__SHORT_TITLE__', meta.shortTitle || '2026 양재천 건강 페스티벌');
template = template.replace('__EVENT_DATE__', meta.eventDate || '2026-10-31(토)');
template = template.replace('__EVENT_TIME__', meta.eventTime || '09:00 ~ 14:00');
template = template.replace('__LOCATION__', meta.location || '양재천 수변문화쉼터 및 출발마당');
template = template.replace('__COURSE__', meta.course || '수변문화쉼터 ↔ 영동5교 왕복 (약 4km)');
template = template.replace('__TARGET__', meta.targetAudience || '강남구민 800명 (사전 접수)');
template = template.replace('__STAFF_NOTE__', meta.staffNote || '행사 참여 직원 대체휴무 시행 예정');
template = template.replace('__APP_DATA_JSON__', JSON.stringify(festivalData));

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'index.html'), template, 'utf8');
fs.writeFileSync(path.join(outDir, '404.html'), template, 'utf8');

const festivalYangjaeDir = path.join(outDir, 'festival', 'yangjae');
fs.mkdirSync(festivalYangjaeDir, { recursive: true });
fs.writeFileSync(path.join(festivalYangjaeDir, 'index.html'), template, 'utf8');

const festivalDir = path.join(outDir, 'festival');
fs.writeFileSync(path.join(festivalDir, 'yangjae.html'), template, 'utf8');

console.log('[OK] Successfully prepared Pages output in out/ with title 2026 양재천 걷자! 건강페스티벌 and zero redirects.');
