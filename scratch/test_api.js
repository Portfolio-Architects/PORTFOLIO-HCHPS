const http = require('http');

const data = JSON.stringify({
  username: 'ocs5298',
  password: '34237116!a'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Sending POST to http://localhost:3001/api/auth ...');
const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('BODY:', body);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(data);
req.end();
