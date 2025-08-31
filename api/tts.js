// api/tts.js
// Vercel Serverless Function - ElevenLabs TTS Proxy
// Auth: header "Miguel: <PROXY_KEY>"
export default async function handler(req, res) {
  // Basic CORS (useful if you ever call from a browser)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Miguel");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "OK - ElevenLabs TTS Proxy" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
    const PROXY_KEY = process.env.PROXY_KEY;

    if (!ELEVENLABS_KEY) {
      return res.status(500).json({ error: "Missing ELEVENLABS_API_KEY" });
    }
    if (PROXY_KEY && req.headers["miguel"] !== PROXY_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body || {};
    const text = (body.text ?? "").toString();
    let voiceId = body.voice_id;

    if (!text) {
      return res.status(400).json({ error: "Missing 'text' (string)" });
    }
    if (text.length > 1200) {
      return res.status(400).json({ error: "Text too long (max 1200 chars)" });
    }

    // Map common voice names -> IDs
    const VOICE_ID_MAP = {
      rachel: "21m00Tcm4TlvDq8ikWAM",
      adam: "pNInz6obpgDQGcFmaJgB",
      bella: "EXAVITQu4vr4xnSDxMaL",
      antoni: "ErXwobaYiN019PkySvjV",
      domi: "AZnzlk1XvdvUeBnXmlld"
    };

    if (!voiceId) {
      voiceId = VOICE_ID_MAP.rachel;
    } else {
      const key = String(voiceId).toLowerCase();
      voiceId = VOICE_ID_MAP[key] ?? voiceId; // leave as-is if it's an actual ID
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

    const payload = {
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.8
      }
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => "");
      return res.status(resp.status).json({
        error: "ElevenLabs error",
        status: resp.status,
        details: errTxt
      });
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    const b64 = buf.toString("base64");

    return res.status(200).json({
      audio_base64: b64,
      data_url: `data:audio/mpeg;base64,${b64}`,
      mime: "audio/mpeg"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
}
