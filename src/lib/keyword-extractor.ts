// Korean stopwords (particles, postpositions, common verbs, etc.)
const STOPWORDS = new Set([
  '이', '그', '저', '것', '수', '등', '들', '및', '에', '의', '를', '을', '가', '는', '은', '로', '과', '와', '에서',
  '으로', '까지', '부터', '에게', '한테', '께', '처럼', '만큼', '대로', '보다', '같이', '하다', '되다', '있다', '없다',
  '않다', '이다', '아니다', '하고', '또는', '혹은', '그리고', '그러나', '하지만', '때문', '위해', '통해', '관련',
  '대한', '따라', '대해', '따른', '위한', '관한', '의한', '있는', '없는', '하는', '되는', '이런', '저런', '그런',
  '모든', '어떤', '무슨', '어느', '각', '더', '매우', '아주', '너무', '좀', '약간', '거의', '다시', '이미', '아직',
  '항상', '자주', '가끔', '때', '중', '후', '전', '간', '내', '외', '상', '하', '대', '소', '해', '할', '된',
  '인', '적', '고', '면', '며', '나', '요', '다', '지', '서', '기', '도', '만', '데', '씩', '번', '째', '총',
  '제', '약', '각종', '여러', '주요', '주로', '이상', '이하', '이내', '기타', '별도', '해당', '관계', '경우',
  '필요', '사항', '내용', '사용', '활용', '진행', '실시', '추진', '수행', '완료', '예정', '계획',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'under', 'over', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'than', 'too', 'very', 'just', 'also', 'then', 'its', 'it', 'this', 'that', 'these', 'those', 'my',
  'your', 'his', 'her', 'our', 'their', 'which', 'who', 'whom', 'what', 'where', 'when', 'how', 'why',
]);

function tokenize(text: string): string[] {
  // Split by whitespace, punctuation, special chars
  return text
    .replace(/[^\w\sㄱ-ㅎ가-힣]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length >= 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

export interface KeywordResult {
  word: string;
  count: number;
  score: number;
}

export interface CoOccurrence {
  source: string;
  target: string;
  weight: number;
}

export function extractKeywords(text: string, maxKeywords: number = 30): KeywordResult[] {
  const tokens = tokenize(text);
  const freq: Record<string, number> = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });

  return Object.entries(freq)
    .map(([word, count]) => ({ word, count, score: count }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxKeywords);
}

export function analyzeCoOccurrence(text: string, keywords: KeywordResult[], windowSize: number = 1): CoOccurrence[] {
  // Split text into sentences/segments
  const segments = text.split(/[.。!?;\n]+/).filter(s => s.trim().length > 0);
  const keywordSet = new Set(keywords.map(k => k.word));
  const coMap: Record<string, number> = {};

  segments.forEach(segment => {
    const tokens = tokenize(segment).filter(t => keywordSet.has(t));
    const uniqueTokens = [...new Set(tokens)];
    for (let i = 0; i < uniqueTokens.length; i++) {
      for (let j = i + 1; j < uniqueTokens.length; j++) {
        const key = [uniqueTokens[i], uniqueTokens[j]].sort().join('|||');
        coMap[key] = (coMap[key] || 0) + 1;
      }
    }
  });

  return Object.entries(coMap)
    .map(([key, weight]) => {
      const [source, target] = key.split('|||');
      return { source, target, weight };
    })
    .sort((a, b) => b.weight - a.weight);
}
