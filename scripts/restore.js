const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('\n==================================================');
  console.log('📊 HCHPS Work & Wealth - 로컬 데이터 복구 시스템');
  console.log('==================================================\n');

  if (!fs.existsSync(BACKUPS_DIR)) {
    console.log('❌ 백업 폴더가 존재하지 않습니다. (data/backups/)');
    rl.close();
    return;
  }

  // Get sheet list from directories under data/backups/
  let sheets = [];
  try {
    sheets = fs.readdirSync(BACKUPS_DIR).filter(file => {
      const fullPath = path.join(BACKUPS_DIR, file);
      return fs.statSync(fullPath).isDirectory();
    });
  } catch (err) {
    console.error('백업 디렉토리를 읽는 도중 오류가 발생했습니다:', err);
    rl.close();
    return;
  }

  if (sheets.length === 0) {
    console.log('ℹ️ 저장된 백업이 없습니다.');
    rl.close();
    return;
  }

  console.log('복구할 데이터 시트를 선택하세요:');
  sheets.forEach((sheet, idx) => {
    console.log(`[${idx + 1}] ${sheet}`);
  });
  console.log('');

  const sheetChoice = await question('번호를 입력하세요 (이전 단계로 가려면 Enter): ');
  const sheetIdx = parseInt(sheetChoice.trim(), 10) - 1;

  if (isNaN(sheetIdx) || sheetIdx < 0 || sheetIdx >= sheets.length) {
    console.log('❌ 올바르지 않은 번호이거나 취소되었습니다.');
    rl.close();
    return;
  }

  const selectedSheet = sheets[sheetIdx];
  const sheetBackupDir = path.join(BACKUPS_DIR, selectedSheet);

  let backups = [];
  try {
    backups = fs.readdirSync(sheetBackupDir).filter(file => file.endsWith('.json')).sort();
  } catch (err) {
    console.error('백업 파일을 읽는 도중 오류가 발생했습니다:', err);
    rl.close();
    return;
  }

  if (backups.length === 0) {
    console.log('ℹ️ 이 시트에 저장된 백업 파일이 없습니다.');
    rl.close();
    return;
  }

  // Show last 15 backups (newest first)
  const sortedBackups = [...backups].reverse().slice(0, 15);

  console.log(`\n--------------------------------------------------`);
  console.log(`📂 [${selectedSheet}] 백업 목록 (최신 항목 순):`);
  console.log(`--------------------------------------------------`);
  sortedBackups.forEach((file, idx) => {
    // Format timestamp from filename (e.g. 2026-05-22T08-15-00-123Z_BUDGET_ENTRIES.json)
    // Timestamp could be: 2026-05-22T08-15-00-123Z or other. Let's make display formatting robust
    const nameWithoutExt = file.replace(/\.json$/, '');
    const timePart = nameWithoutExt.substring(0, 24).replace(/-/g, ':').replace(/T/, ' ').replace(/:([0-9]+)$/, '.$1');
    console.log(`[${idx + 1}] ${timePart} (${file})`);
  });
  console.log('');

  const backupChoice = await question('복구할 백업 번호를 입력하세요: ');
  const backupIdx = parseInt(backupChoice.trim(), 10) - 1;

  if (isNaN(backupIdx) || backupIdx < 0 || backupIdx >= sortedBackups.length) {
    console.log('❌ 올바르지 않은 번호이거나 취소되었습니다.');
    rl.close();
    return;
  }

  const selectedBackupFile = sortedBackups[backupIdx];
  const sourcePath = path.join(sheetBackupDir, selectedBackupFile);
  const targetPath = path.join(DATA_DIR, `${selectedSheet}.json`);

  console.log(`\n⚠️ 경고: [${selectedSheet}] 데이터를 복구하면 현재 데이터가 덮어씌워집니다.`);
  const confirm = await question('계속 진행하시겠습니까? (y/N): ');
  
  if (confirm.trim().toLowerCase() !== 'y') {
    console.log('❌ 복구가 취소되었습니다.');
    rl.close();
    return;
  }

  try {
    // Create pre-restore snapshot
    if (fs.existsSync(targetPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const preRestoreFile = path.join(sheetBackupDir, `pre_restore_${timestamp}_${selectedSheet}.json`);
      fs.copyFileSync(targetPath, preRestoreFile);
      console.log(`\n📦 현재 데이터의 예비 스냅샷을 저장했습니다:`);
      console.log(`   -> ${path.relative(process.cwd(), preRestoreFile)}`);
    }

    // Restore data
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`\n🎉 성공적으로 데이터를 복구했습니다!`);
    console.log(`   -> 대상: ${path.relative(process.cwd(), targetPath)}`);
  } catch (err) {
    console.error('❌ 복구 작업 도중 오류가 발생했습니다:', err);
  }

  rl.close();
}

main();
