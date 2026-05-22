const fs = require('fs');
fetch('http://localhost:3001/api/data?sheet=BUDGET_CATEGORIES', { headers: { Cookie: 'hchps_session=authenticated-secure-session-token' } }).then(r=>r.text()).then(t => {
    try {
        const parsed = JSON.parse(t);
        const dataArr = parsed.data;
        const filtered = dataArr.filter(c => c.detailedProject === '건강증진지원실 운영');
        console.log("Parsed JSON successfully, total items:", dataArr.length);
        console.log("건강증진지원실 운영 count:", filtered.length);
    } catch(e) {
        console.error("NOT JSON:", t.substring(0, 100));
    }
    process.exit(0);
});
