/**
 * HCHPS Work Manager — Google Apps Script Web App
 * 이 코드를 Google 스프레드시트의 "확장 프로그램 → Apps Script"에 붙여넣고 배포하세요.
 *
 * 배포 방법:
 * 1. Google 스프레드시트 열기 (ID: 1Ktm5PDYOHm4r5te1vnPC5gcAoIuRFxM5w5X5mSF6DGE)
 * 2. 확장 프로그램 → Apps Script
 * 3. 이 코드 전체를 Code.gs에 붙여넣기
 * 4. 배포 → 새 배포 → 웹 앱 → 
 *    - 실행 대상: "나"
 *    - 액세스 권한: "모든 사용자"
 * 5. 배포 → URL 복사
 * 6. Work Manager 앱의 src/lib/sheets-api.ts 에 URL 붙여넣기
 */

// 스프레드시트 참조
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// ============ GET: 읽기 ============
function doGet(e) {
  const params = e.parameter;
  const sheetName = params.sheet;
  const action = params.action || 'read';

  try {
    if (action === 'read') {
      const sheet = getSheet(sheetName);
      const data = sheet.getDataRange().getValues();
      
      if (data.length <= 1) {
        return jsonResponse({ success: true, data: [] });
      }

      const headers = data[0];
      const rows = data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          let val = row[i];
          // Parse JSON strings (arrays/objects)
          if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
            try { val = JSON.parse(val); } catch(_) {}
          }
          // Boolean conversion
          if (val === 'TRUE' || val === 'true') val = true;
          if (val === 'FALSE' || val === 'false') val = false;
          obj[h] = val;
        });
        return obj;
      });

      return jsonResponse({ success: true, data: rows });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============ POST: 쓰기 ============
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { sheet: sheetName, action, data, id } = body;
    const sheet = getSheet(sheetName);

    switch (action) {
      case 'add':
        return handleAdd(sheet, data);
      case 'update':
        return handleUpdate(sheet, id, data);
      case 'delete':
        return handleDelete(sheet, id);
      case 'replace':
        return handleReplace(sheet, data);
      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// 행 추가
function handleAdd(sheet, data) {
  const headers = getOrCreateHeaders(sheet, data);
  const row = headers.map(h => {
    const val = data[h];
    if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
      return JSON.stringify(val);
    }
    return val !== undefined ? val : '';
  });
  sheet.appendRow(row);
  return jsonResponse({ success: true });
}

// 행 수정 (id 기준)
function handleUpdate(sheet, id, data) {
  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return jsonResponse({ success: false, error: 'No data' });

  const headers = allData[0];
  const idCol = headers.indexOf('id');
  if (idCol === -1) return jsonResponse({ success: false, error: 'No id column' });

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      headers.forEach((h, j) => {
        if (data.hasOwnProperty(h)) {
          let val = data[h];
          if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
            val = JSON.stringify(val);
          }
          sheet.getRange(i + 1, j + 1).setValue(val);
        }
      });
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'ID not found: ' + id });
}

// 행 삭제 (id 기준)
function handleDelete(sheet, id) {
  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return jsonResponse({ success: false, error: 'No data' });

  const headers = allData[0];
  const idCol = headers.indexOf('id');
  if (idCol === -1) return jsonResponse({ success: false, error: 'No id column' });

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'ID not found: ' + id });
}

// 전체 교체 (프로젝트 체크리스트 업데이트 등)
function handleReplace(sheet, dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    // Clear all data except header
    const last = sheet.getLastRow();
    if (last > 1) sheet.deleteRows(2, last - 1);
    return jsonResponse({ success: true });
  }

  const headers = getOrCreateHeaders(sheet, dataArray[0]);
  
  // Clear existing data
  const last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);

  // Write all rows
  const rows = dataArray.map(item => 
    headers.map(h => {
      const val = item[h];
      if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
        return JSON.stringify(val);
      }
      return val !== undefined ? val : '';
    })
  );

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  return jsonResponse({ success: true });
}

// 헤더 자동 생성
function getOrCreateHeaders(sheet, sampleData) {
  const existing = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0].filter(h => h !== '');
  
  if (existing.length > 0) return existing;

  // Create headers from data keys
  const headers = Object.keys(sampleData);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return headers;
}

// JSON 응답 헬퍼
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
