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

async function test() {
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });
    
    console.log("Generating text...");
    const result = await model.generateContent("대한민국의 역사에 대해 300자 이상으로 길게 설명해줘.");
    console.log("Text length:", result.response.text().length);
    console.log("Preview:\n", result.response.text().substring(0, 500));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
