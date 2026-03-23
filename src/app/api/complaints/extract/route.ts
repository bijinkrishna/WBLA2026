import { NextResponse } from 'next/server';

type Extracted = {
  complainantName?: string;
  complainantMobile?: string;
  complainantEmail?: string;
  assemblyConstituency?: string;
  blockMunicipality?: string;
  originalBengali?: string;
  englishSummary?: string;
  locationBoothBlock?: string;
  category?: string;
  urgency?: string;
};

function normalizeMobile(input?: string): string | undefined {
  if (!input) return undefined;
  const digits = input.replace(/\D/g, '');
  const ten = digits.slice(-10);
  return /^[6-9]\d{9}$/.test(ten) ? ten : undefined;
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ data: null, reason: 'AI not configured' }, { status: 200 });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const prompt = `
Extract structured complaint fields from this complaint text.
Return only valid JSON object with keys:
complainantName, complainantMobile, complainantEmail, assemblyConstituency, blockMunicipality, originalBengali, englishSummary, locationBoothBlock, category, urgency.

Rules:
- Keep unknown fields as empty string.
- category must be MCC or L&O when inferable, else empty string.
- urgency must be one of: Low, Medium, High, Critical when inferable, else empty string.
- complainantMobile should be 10-digit Indian mobile if possible.
Complaint text:
${text}
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: `You extract election complaint fields into JSON only.\n\n${prompt}` }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ data: null, reason: err }, { status: 200 });
    }

    const json = await response.json();
    const contentRaw = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const content = String(contentRaw).replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    let parsed: Extracted = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const cleaned: Extracted = {
      complainantName: parsed.complainantName?.trim() || '',
      complainantMobile: normalizeMobile(parsed.complainantMobile) || '',
      complainantEmail: parsed.complainantEmail?.trim() || '',
      assemblyConstituency: parsed.assemblyConstituency?.trim() || '',
      blockMunicipality: parsed.blockMunicipality?.trim() || '',
      originalBengali: parsed.originalBengali?.trim() || text,
      englishSummary: parsed.englishSummary?.trim() || '',
      locationBoothBlock: parsed.locationBoothBlock?.trim() || '',
      category: parsed.category === 'MCC' || parsed.category === 'L&O' ? parsed.category : '',
      urgency: ['Low', 'Medium', 'High', 'Critical'].includes(parsed.urgency || '') ? parsed.urgency : '',
    };

    return NextResponse.json({ data: cleaned });
  } catch (e) {
    return NextResponse.json({ data: null, reason: 'extract failed' }, { status: 200 });
  }
}
