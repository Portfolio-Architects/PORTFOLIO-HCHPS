const LAW_API_KEY = '4611c02045e69b5e6c0bf50b9ecbee6de92e7ee0351eb8a7d529253340f755ff';

function extractTag(xmlBlock, tagName) {
  const match = xmlBlock.match(new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`, 'i'));
  return match ? match[1].trim() : '';
}

async function searchLawMst(query, target = 'law') {
  const url = `http://www.law.go.kr/DRF/lawSearch.do?OC=${LAW_API_KEY}&target=${target}&type=XML&query=${encodeURIComponent(query)}&page=1&display=5`;
  console.log('Requesting URL:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    const xmlText = await res.text();
    console.log('Response body prefix:', xmlText.substring(0, 500));
    
    // Parse items (every <law>...</law> block)
    const items = [];
    const lawBlockRegex = /<law>([\s\S]*?)<\/law>/g;
    let match;
    
    while ((match = lawBlockRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      const id = extractTag(itemXml, '법령일련번호') || extractTag(itemXml, '행정규칙일련번호') || extractTag(itemXml, '자치법규일련번호');
      const title = extractTag(itemXml, '법령명한글') || extractTag(itemXml, '행정규칙명') || extractTag(itemXml, '자치법규명한글');
      if (id && title) {
        items.push({ id, title });
      }
    }
    return items;
  } catch (err) {
    console.error(`Error searching ${query}:`, err);
    return [];
  }
}

async function getLawBody(mst, target = 'law') {
  const url = `http://www.law.go.kr/DRF/lawService.do?OC=${LAW_API_KEY}&target=${target}&type=XML&MST=${mst}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    return await res.text();
  } catch (err) {
    console.error(`Error fetching law body for MST ${mst}:`, err);
    return '';
  }
}

function parseAndFilterLawBody(xmlText, keyword) {
  const joBlocks = [];
  const regex = /<조문단위[^>]*>([\s\S]*?)<\/조문단위>/g;
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    const block = match[1];
    const title = extractTag(block, '조문제목');
    const content = extractTag(block, '조문내용');
    
    const hangRegex = /<항내용>([\s\S]*?)<\/항내용>/g;
    let hangMatch;
    const hangs = [];
    while ((hangMatch = hangRegex.exec(block)) !== null) {
      hangs.push(hangMatch[1].trim());
    }
    
    const combinedText = `${title} ${content} ${hangs.join(' ')}`;
    if (combinedText.includes(keyword)) {
      joBlocks.push({
        title,
        content,
        hangs
      });
    }
  }
  return joBlocks;
}

async function run() {
  console.log('--- 1. 장애인·노인·임산부 등의 편의증진 보장에 관한 법률 검색 ---');
  const laws1 = await searchLawMst('장애인 노인 임산부 등의 편의증진');
  if (laws1.length > 0) {
    const targetLaw = laws1[0];
    console.log(`Found: ${targetLaw.title} (MST: ${targetLaw.id})`);
    const xml = await getLawBody(targetLaw.id);
    const matches = parseAndFilterLawBody(xml, '계단');
    console.log(`Found ${matches.length} articles matching "계단":`);
    matches.slice(0, 5).forEach(m => {
      console.log(`- [${m.title}] ${m.content}`);
      m.hangs.forEach(h => console.log(`  > ${h}`));
    });
  }

  console.log('\n--- 2. 건축물의 피난·방화구조 등의 기준에 관한 규칙 검색 ---');
  const laws2 = await searchLawMst('건축물의 피난');
  if (laws2.length > 0) {
    const targetLaw = laws2[0];
    console.log(`Found: ${targetLaw.title} (MST: ${targetLaw.id})`);
    const xml = await getLawBody(targetLaw.id);
    const matches = parseAndFilterLawBody(xml, '계단');
    console.log(`Found ${matches.length} articles matching "계단":`);
    matches.slice(0, 5).forEach(m => {
      console.log(`- [${m.title}] ${m.content}`);
      m.hangs.forEach(h => console.log(`  > ${h}`));
    });
  }

  console.log('\n--- 3. 국가배상법 검색 ---');
  const laws3 = await searchLawMst('국가배상법');
  if (laws3.length > 0) {
    const targetLaw = laws3[0];
    console.log(`Found: ${targetLaw.title} (MST: ${targetLaw.id})`);
    const xml = await getLawBody(targetLaw.id);
    const matches = parseAndFilterLawBody(xml, '영조물');
    console.log(`Found ${matches.length} articles matching "영조물":`);
    matches.forEach(m => {
      console.log(`- [${m.title}] ${m.content}`);
      m.hangs.forEach(h => console.log(`  > ${h}`));
    });
  }
}

run();
