const LAW_API_KEY = '4611c02045e69b5e6c0bf50b9ecbee6de92e7ee0351eb8a7d529253340f755ff';

async function testApi() {
  const query = '지방재정법';
  const url = `http://www.law.go.kr/DRF/lawSearch.do?OC=${LAW_API_KEY}&target=law&type=XML&query=${encodeURIComponent(query)}&page=1&display=5`;
  
  console.log('Fetching:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const text = await res.text();
    console.log('Response status:', res.status);
    console.log('Response body preview:', text.substring(0, 1000));
  } catch (err) {
    console.error('Error fetching API:', err);
  }
}

testApi();
