// lib/transcription.js — speech-to-text for Telegram voice notes.
//
// Uses Groq's Whisper-large-v3-turbo if GROQ_API_KEY is set (fast + cheap).
// Falls back to OpenAI Whisper if OPENAI_API_KEY is set instead.
// Returns null if neither key is configured — the caller should then send a
// graceful "voice transcription unavailable" message.

const GROQ_URL   = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions';

function pickProvider() {
  if (process.env.GROQ_API_KEY) {
    return { url: GROQ_URL, key: process.env.GROQ_API_KEY, model: 'whisper-large-v3-turbo' };
  }
  if (process.env.OPENAI_API_KEY) {
    return { url: OPENAI_URL, key: process.env.OPENAI_API_KEY, model: 'whisper-1' };
  }
  return null;
}

export function isTranscriptionAvailable() {
  return !!pickProvider();
}

// buf: Buffer of audio bytes (Telegram OGG/Opus is supported by both providers)
export async function transcribe(buf, { mimeType = 'audio/ogg', language = null } = {}) {
  const provider = pickProvider();
  if (!provider) return null;

  const form = new FormData();
  const blob = new Blob([buf], { type: mimeType });
  form.append('file', blob, 'voice.ogg');
  form.append('model', provider.model);
  if (language) form.append('language', language);
  form.append('response_format', 'json');

  try {
    const res = await fetch(provider.url, {
      method:  'POST',
      headers: { Authorization: `Bearer ${provider.key}` },
      body:    form,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[transcription] provider error:', res.status, errText.slice(0, 200));
      return null;
    }
    const data = await res.json();
    return (data?.text || '').trim() || null;
  } catch (err) {
    console.error('[transcription] fetch error:', err.message);
    return null;
  }
}
