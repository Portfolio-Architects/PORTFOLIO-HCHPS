async function checkAppsScript() {
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6EJl_O0px8OXXeuEzmpfqLOqFzfO9u5LEzzoD2CQy86pocgFWx46gDZ0HQdOkf8TH/exec';
  const sheets = ['TASKS', 'MEETINGS', 'PROJECTS', 'BUDGET_CATEGORIES', 'BUDGET_ENTRIES'];
  
  for (const sheet of sheets) {
    const url = `${APPS_SCRIPT_URL}?action=read&sheet=${encodeURIComponent(sheet)}`;
    try {
      const res = await fetch(url);
      console.log(`Sheet [${sheet}]: status=${res.status}`);
      if (res.ok) {
        const json = await res.json();
        console.log(`  Success: ${json.success}`);
        if (json.success) {
          console.log(`  Data Length: ${json.data ? json.data.length : 'N/A'}`);
          if (json.data && json.data.length > 0) {
            console.log(`  Sample row:`, JSON.stringify(json.data[0]).slice(0, 300));
          }
        } else {
          console.log(`  Error: ${json.error}`);
        }
      }
    } catch (e) {
      console.error(`Error fetching ${sheet}:`, e);
    }
  }
}

checkAppsScript();
