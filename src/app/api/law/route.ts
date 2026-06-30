import { NextResponse } from 'next/server';

const LAW_API_KEY = process.env.LAW_API_KEY || '';

function extractTag(xmlBlock: string, tagName: string): string {
  const match = xmlBlock.match(new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`, 'i'));
  return match ? match[1].trim() : '';
}

function parseXmlItem(xmlBlock: string) {
  const idTags = ['법령일련번호', '행정규칙일련번호', '자치법규일련번호', 'admrulId', 'ordinSeq', '자치법규ID', 'ID'];
  const nameTags = ['법령명한글', '행정규칙명', '자치법규명', 'admrulNm', 'ordinNm', '자치법규명한글'];
  const dateTags = ['시행일자', 'prmlDt', '공포일자', '제정개정일자'];
  const agencyTags = ['소관부처명', '소관부처', '지자체명', '지자체기관명', '소관지자체명', 'ocmpDeptNm', 'orgNm'];
  
  let id = '';
  for (const tag of idTags) {
    id = extractTag(xmlBlock, tag);
    if (id) break;
  }
  
  let title = '';
  for (const tag of nameTags) {
    title = extractTag(xmlBlock, tag);
    if (title) break;
  }
  
  let date = '';
  for (const tag of dateTags) {
    date = extractTag(xmlBlock, tag);
    if (date) break;
  }
  
  let agency = '';
  for (const tag of agencyTags) {
    agency = extractTag(xmlBlock, tag);
    if (agency) break;
  }
  
  const link = extractTag(xmlBlock, 'link');
  
  return { id, title, date, agency, link };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mst = searchParams.get('mst') || '';
    const query = searchParams.get('query') || '';
    const target = searchParams.get('target') || 'law'; // law, admrul, ordin
    const page = searchParams.get('page') || '1';
    const type = searchParams.get('type') || 'HTML'; // HTML or XML for body

    if (!LAW_API_KEY) {
      return NextResponse.json({ error: 'LAW_API_KEY is not configured in .env.local' }, { status: 500 });
    }

    // 1. Body Search (본문 조회)
    if (mst) {
      const url = `http://www.law.go.kr/DRF/lawService.do?OC=${LAW_API_KEY}&target=${target}&type=${type}&MST=${mst}`;
      
      console.log(`[Law API Route] Direct request for body: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': type === 'HTML' ? 'text/html' : 'application/xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch law body. Status: ${response.status}`);
      }

      const text = await response.text();

      // Check if body response is actually an XML error (e.g. user validation failed)
      if (text.includes('<result>') && text.includes('<msg>')) {
        const result = extractTag(text, 'result');
        const msg = extractTag(text, 'msg');
        return NextResponse.json({ success: false, error: `${result} - ${msg}` }, { status: 400 });
      }

      return new NextResponse(text, {
        headers: {
          'Content-Type': type === 'HTML' ? 'text/html; charset=utf-8' : 'application/xml; charset=utf-8',
        }
      });
    }

    // 2. List Search (목록 조회)
    if (!query) {
      return NextResponse.json({ totalCnt: 0, items: [] });
    }

    const url = `http://www.law.go.kr/DRF/lawSearch.do?OC=${LAW_API_KEY}&target=${target}&type=XML&query=${encodeURIComponent(query)}&page=${page}&display=50`;

    console.log(`[Law API Route] Direct request for list: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch law list. Status: ${response.status}`);
    }

    const xmlText = await response.text();

    // Check if direct response is an XML error (e.g. user validation failed due to unregistered IP)
    if (xmlText.includes('<result>') && xmlText.includes('<msg>')) {
      const result = extractTag(xmlText, 'result');
      const msg = extractTag(xmlText, 'msg');
      return NextResponse.json({ success: false, error: `${result} - ${msg}` }, { status: 400 });
    }
    
    // Parse totalCnt
    const totalCntMatch = xmlText.match(/<totalCnt>([^<]*)<\/totalCnt>/i);
    const totalCnt = totalCntMatch ? parseInt(totalCntMatch[1].trim(), 10) : 0;

    // Parse items (every <law>...</law> block)
    const items: any[] = [];
    const lawBlockRegex = /<law>([\s\S]*?)<\/law>/g;
    let match;
    
    while ((match = lawBlockRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      const parsedItem = parseXmlItem(itemXml);
      if (parsedItem.title) {
        items.push(parsedItem);
      }
    }

    return NextResponse.json({
      success: true,
      totalCnt,
      page: parseInt(page, 10),
      items
    });

  } catch (err: any) {
    console.error('[Law API Route] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Unknown error' }, { status: 500 });
  }
}
