/**
 * Groq LLM utility — handles all AI-blended features:
 *  - Report categorization & severity scoring
 *  - Image-context verification (text-based reasoning over user description + metadata)
 *  - Health / environmental impact explanation
 *  - Actionable reduction & solution suggestions
 *  - Auto-generated formal government complaint text
 *  - Auto-generated social media post captions
 */
const fetch = require('node-fetch');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callGroq(messages, { temperature = 0.4, max_tokens = 900, json = false } = {}) {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY is not configured on the server. Add it to your .env file.');
  }

  const body = {
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages,
    temperature,
    max_tokens,
  };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

const CATEGORY_LIST = [
  'littering_dumping',
  'spitting_public',
  'pothole',
  'dust_pollution',
  'bad_aqi',
  'open_burning_waste',
  'tree_cutting_illegal',
  'vehicle_smoke_emission',
  'sewage_overflow',
  'water_leakage',
  'broken_streetlight',
  'noise_pollution',
  'stray_animal_hazard',
  'illegal_construction',
  'other',
];

async function analyzeReport({ category, description, latitude, longitude, hasImage }) {
  const sys = `You are Nagrik360's civic-issue analysis engine. You receive a citizen-submitted civic/environmental complaint (category, description, optional location, whether a photo was attached) and respond ONLY with strict JSON matching this schema:
{
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": number (0-1, your confidence this is a genuine, well-formed civic report and not spam/nonsense),
  "is_plausible": boolean,
  "summary": "one crisp sentence summarizing the issue for an officer's dashboard",
  "health_impact": ["bullet point", "bullet point", "..."],  // 3-5 concise points on health/environmental/social side effects
  "solutions": [
     {"who": "Citizen", "action": "short actionable step"},
     {"who": "Local Authority", "action": "short actionable step"},
     {"who": "Community", "action": "short actionable step"}
  ],  // 4-6 total entries mixing who=Citizen/Local Authority/Community/Government
  "suggested_department": "e.g. Municipal Sanitation Dept / Traffic Police / Forest Dept / Pollution Control Board",
  "gov_complaint_text": "a formal, polite, 80-120 word complaint letter paragraph ready to send to a government grievance portal, written in first person on behalf of the citizen, referencing category and location generically",
  "social_caption": "a punchy, factual, non-defamatory ~25 word social media caption with 3-4 relevant hashtags, suitable for Twitter/X or WhatsApp, raising civic awareness without naming any individual"
}
Valid categories: ${CATEGORY_LIST.join(', ')}. Be concise, practical, and India-civic-context aware where relevant (municipal corporations, RWAs, Swachh Bharat norms, CPCB AQI bands). Do not include markdown, only raw JSON.`;

  const user = `Category: ${category}
Description: ${description || '(no text description provided)'}
Location: ${latitude && longitude ? `${latitude}, ${longitude}` : 'not shared'}
Photo attached: ${hasImage ? 'yes' : 'no'}`;

  const content = await callGroq(
    [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    { json: true, temperature: 0.35, max_tokens: 1100 }
  );

  try {
    return JSON.parse(content);
  } catch (e) {
    return {
      severity: 'medium',
      confidence: 0.5,
      is_plausible: true,
      summary: description?.slice(0, 140) || 'Civic issue reported',
      health_impact: ['Could not auto-analyze fully — please review manually.'],
      solutions: [],
      suggested_department: 'Municipal Corporation',
      gov_complaint_text: description || '',
      social_caption: `Reported a civic issue near me via Nagrik360 🚩 #CivicSense #CleanIndia`,
      raw_error: e.message,
    };
  }
}

async function chatAssistant(messages) {
  const sys = {
    role: 'system',
    content:
      "You are the Nagrik360 in-app civic assistant. Help users understand pollution, waste management, road safety, tree protection, and how to report issues effectively. Keep answers short, practical, India-civic-context aware, and encouraging. Never give legal advice as fact — suggest consulting local authorities for legal specifics.",
  };
  return callGroq([sys, ...messages], { temperature: 0.6, max_tokens: 500 });
}

module.exports = { analyzeReport, chatAssistant, CATEGORY_LIST };
