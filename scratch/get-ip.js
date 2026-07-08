async function getPublicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    console.log('Public IP:', data.ip);
  } catch (err) {
    console.error('Error fetching public IP:', err);
  }
}
getPublicIp();
