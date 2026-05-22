async function checkGoogleSheet() {
  const spreadsheetId = '1Ktm5PDYOHm4r5te1vnPC5gcAoIuRFxM5w5X5mSF6DGE';
  const sheets = ['TASKS', 'MEETINGS', 'PROJECTS', 'BUDGET_CATEGORIES', 'BUDGET_ENTRIES'];
  
  for (const sheet of sheets) {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
    try {
      const res = await fetch(url);
      console.log(`Sheet [${sheet}]: status=${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Length: ${text.length}`);
        console.log(`  Snippet:`, text.slice(0, 300));
      }
    } catch (e) {
      console.error(`Error fetching ${sheet}:`, e);
    }
  }
}

checkGoogleSheet();
