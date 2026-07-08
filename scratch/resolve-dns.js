const dns = require('dns');

dns.lookup('www.law.go.kr', { all: true }, (err, addresses) => {
  if (err) {
    console.error('DNS lookup failed:', err.message);
  } else {
    console.log('Addresses:', addresses);
  }
});
