const fs = require('fs');

const file = fs.readFileSync('data/MAP_CUSTOMIZATION.json', 'utf8');
const data = JSON.parse(file);

const encStr = data[0]._enc;
// It's base64 encoded.
const binaryString = atob(encStr);
console.log('Decoded length:', binaryString.length);
console.log('Starts with:', binaryString.substring(12, 100)); // skip IV
