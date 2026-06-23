const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  });
}

const apiKey = process.env.GOOGLE_GEMINI_API_KEY || '';

async function run() {
  const genAI = new GoogleGenerativeAI(apiKey);
  console.log('Listing models...');
  
  // listModels is not always directly available on GoogleGenerativeAI class, but we can try 
  // checking if there are standard API endpoints or using standard model testing.
  // We can try to query directly using listModels.
  try {
    // Standard JS SDK method to list models
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log('Available Models:');
    if (data.models) {
      data.models.forEach(m => {
        console.log(`- ${m.name} (${m.displayName})`);
      });
    } else {
      console.log('No models returned. Response:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('Failed to fetch models:', err);
  }
}

run().catch(console.error);
