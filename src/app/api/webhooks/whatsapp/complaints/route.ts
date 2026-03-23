import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twimlMessage(text: string) {
  const escaped = xmlEscape(text);
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

function normalizeMobile(input?: string): string | undefined {
  if (!input) return undefined;
  const digits = input.replace(/\D/g, '');
  const ten = digits.slice(-10);
  return /^[6-9]\d{9}$/.test(ten) ? ten : undefined;
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function verifyTwilioSignature(url: string, params: Record<string, string>, authToken: string, signature: string) {
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((k) => `${k}${params[k] ?? ''}`)
      .join('');

  const digest = createHmac('sha1', authToken).update(payload).digest('base64');
  return safeEqual(digest, signature);
}

async function extractFromText(text: string): Promise<Extracted> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return {};

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    }
  );

  if (!response.ok) return {};
  const json = await response.json();
  const contentRaw = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const content = String(contentRaw).replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(content) as Extracted;
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const xmlHeaders = { 'Content-Type': 'application/xml; charset=utf-8' };
  try {
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((v, k) => {
      if (typeof v === 'string') params[k] = v;
    });

    const body = params.Body?.trim() || '';
    if (!body) {
      return new Response(twimlMessage('Message body is empty. Please resend your complaint text.'), {
        status: 200,
        headers: xmlHeaders,
      });
    }

    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioSignature = req.headers.get('x-twilio-signature') || '';
    if (twilioAuthToken && twilioSignature) {
      const ok = verifyTwilioSignature(req.url, params, twilioAuthToken, twilioSignature);
      if (!ok) {
        return new Response(twimlMessage('Request verification failed.'), {
          status: 403,
          headers: xmlHeaders,
        });
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(twimlMessage('Server configuration missing for complaint intake.'), {
        status: 200,
        headers: xmlHeaders,
      });
    }

    const extracted = await extractFromText(body);
    const from = params.From || '';
    const waId = params.WaId || '';
    const profileName = params.ProfileName || '';
    const inferredMobile = normalizeMobile(from) || normalizeMobile(waId) || normalizeMobile(extracted.complainantMobile);
    const category = extracted.category === 'MCC' || extracted.category === 'L&O' ? extracted.category : null;
    const urgency = ['Low', 'Medium', 'High', 'Critical'].includes(extracted.urgency || '')
      ? extracted.urgency
      : null;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from('complaints')
      .insert({
        complainant_name: extracted.complainantName?.trim() || profileName || null,
        complainant_mobile: inferredMobile || null,
        complainant_email: extracted.complainantEmail?.trim() || null,
        assembly_constituency: extracted.assemblyConstituency?.trim() || 'Unknown',
        block_municipality: extracted.blockMunicipality?.trim() || 'Unknown',
        original_bengali: extracted.originalBengali?.trim() || body,
        english_summary: extracted.englishSummary?.trim() || null,
        location_booth_block: extracted.locationBoothBlock?.trim() || null,
        category,
        urgency,
        recorded_by: 'twilio_whatsapp_webhook',
      })
      .select('id, complaint_code')
      .single();

    if (error) {
      return new Response(twimlMessage('Complaint received, but failed to record. Please retry.'), {
        status: 200,
        headers: xmlHeaders,
      });
    }

    return new Response(twimlMessage(`Complaint recorded successfully. Ref: ${data?.complaint_code || data?.id || 'N/A'}`), {
      status: 200,
      headers: xmlHeaders,
    });
  } catch {
    return new Response(twimlMessage('Unable to process complaint right now. Please try again.'), {
      status: 200,
      headers: xmlHeaders,
    });
  }
}
