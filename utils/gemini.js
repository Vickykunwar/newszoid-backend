const { GoogleGenerativeAI } = require("@google/generative-ai");

let model = null;

function initGemini() {
  try {
    if (!process.env.GEMINI_API_KEY) return null;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-pro" });
    return model;
  } catch {
    return null;
  }
}

async function enhanceWithGemini(text) {
  if (!model) return null;

  try {
    const prompt = `
Summarize the following news in 2–3 neutral lines.
No opinions, no assumptions.

${text}
`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch {
    return null;
  }
}

module.exports = { initGemini, enhanceWithGemini };
