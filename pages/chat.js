import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Avatar from '../components/Avatar';
import { t } from '../lib/i18n';

export default function Chat() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pairing, setPairing] = useState(false);
  const [pairCode, setPairCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [topics, setTopics] = useState([]);
  const [topicsOpen, setTopicsOpen] = useState(false);

  const [attachment, setAttachment] = useState(null); // { dataUrl, media_type, base64 }
  const [recording, setRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const avatarFileRef = useRef(null);
  const recognitionRef = useRef(null);

  // --- Boot session -----------------------------------------------------------
  useEffect(() => {
    if (!router.isReady) return;
    const code = router.query.code;
    const url = code ? `/api/chat/session?code=${encodeURIComponent(code)}` : '/api/chat/session';
    fetch(url, { method: code ? 'POST' : 'GET' })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setError(d.error || 'Could not start session'); return; }
        setUser(d.user);
        setMessages(d.messages || []);
        setSuggestions(d.suggestions || []);
        if (code) router.replace('/chat', undefined, { shallow: true });
      })
      .catch(() => setError('Network error'));

    // Load topics in parallel — used for empty state and the Topics drawer
    fetch('/api/chat/topics')
      .then(r => r.json())
      .then(d => { if (d.ok) setTopics(d.topics || []); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // --- Detect Web Speech support ---------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SR && !!window.speechSynthesis);
  }, []);

  // --- Auto scroll ------------------------------------------------------------
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  // --- Auto speak coach responses --------------------------------------------
  const lastSpokenRef = useRef(0);
  useEffect(() => {
    if (!autoSpeak) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const newAssistant = messages.slice(lastSpokenRef.current).filter(m => m.role === 'assistant');
    lastSpokenRef.current = messages.length;
    for (const m of newAssistant) {
      const text = stripMarkdown(m.text).slice(0, 600);
      if (!text) continue;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = user?.preferred_language === 'km' ? 'km-KH' : 'en-US';
      utter.rate = 1.05;
      window.speechSynthesis.speak(utter);
    }
  }, [messages, autoSpeak, user]);

  function autoGrow(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  // --- Send -------------------------------------------------------------------
  async function send(text, opts = {}) {
    const t = (text || '').trim();
    if ((!t && !attachment) || busy) return;
    if (!opts.autoSend) {
      setMessages(m => [...m, { role: 'user', text: attachment ? `${t}\n[image attached]` : t }]);
    }
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setSuggestions([]);
    setBusy(true);
    const att = attachment;
    setAttachment(null);
    try {
      const body = { text: t };
      if (att) body.attachments = [{ media_type: att.media_type, data: att.base64 }];
      const res = await fetch('/api/chat/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || 'Something went wrong'); return; }
      const newMsgs = (data.replies || []).map(r => ({ role: 'assistant', text: r }));
      setMessages(m => [...m, ...newMsgs]);
      setSuggestions(data.suggestions || []);
      if (data.user) setUser(data.user);
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  // --- Mic (Web Speech API) ---------------------------------------------------
  function toggleMic() {
    if (typeof window === 'undefined') return;
    if (recording) { recognitionRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('Voice input not supported in this browser. Try Chrome or Edge.'); return; }
    const r = new SR();
    r.lang = user?.preferred_language === 'km' ? 'km-KH' : 'en-US';
    r.continuous = false;
    r.interimResults = true;
    let finalText = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setDraft((finalText + interim).trim());
      if (inputRef.current) autoGrow(inputRef.current);
    };
    r.onerror = (e) => { setRecording(false); if (e.error !== 'aborted' && e.error !== 'no-speech') setError(`Mic: ${e.error}`); };
    r.onend = () => setRecording(false);
    recognitionRef.current = r;
    setRecording(true);
    r.start();
  }

  // --- Image attach -----------------------------------------------------------
  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please pick an image.'); return; }
    if (file.size > 6 * 1024 * 1024) { setError('Image too large. Max 6MB.'); return; }
    const dataUrl = await readAsDataUrl(file);
    const base64 = dataUrl.split(',')[1];
    setAttachment({ dataUrl, base64, media_type: file.type });
  }

  // --- Avatar upload ----------------------------------------------------------
  async function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await readAsDataUrl(file);
    const resized = await resizeSquare(dataUrl, 96, 0.78);
    const res = await fetch('/api/chat/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ dataUrl: resized }),
    });
    const data = await res.json();
    if (data.ok) {
      setUser(u => ({ ...u, avatar_url: data.avatar_url }));
    } else {
      setError(data.error || 'Could not upload avatar');
    }
  }

  // --- Pairing ----------------------------------------------------------------
  async function applyCode() {
    const c = pairCode.trim().toUpperCase();
    if (!c) return;
    const res = await fetch(`/api/chat/session?code=${encodeURIComponent(c)}`, { method: 'POST' });
    const data = await res.json();
    if (!data.ok) { setError(data.error || 'Invalid code'); return; }
    setUser(data.user);
    setMessages(data.messages || []);
    setSuggestions([]);
    setPairing(false);
    setPairCode('');
  }

  async function toggleLanguage() {
    const next = user?.preferred_language === 'km' ? 'en' : 'km';
    // Optimistic UI update
    setUser(u => ({ ...u, preferred_language: next }));
    try {
      const res = await fetch('/api/chat/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ preferred_language: next }),
      });
      const j = await res.json();
      if (!j.ok) {
        // Revert if save failed
        setUser(u => ({ ...u, preferred_language: next === 'km' ? 'en' : 'km' }));
        setError(j.error || 'Could not change language');
      }
    } catch {
      setUser(u => ({ ...u, preferred_language: next === 'km' ? 'en' : 'km' }));
      setError('Network error');
    }
  }

  async function generateCode() {
    setError(null);
    try {
      const res = await fetch('/api/chat/pairing-code', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) { setError(data.error || 'Could not generate code'); return; }
      setGeneratedCode(data.code);
    } catch {
      setError('Network error');
    }
  }

  return (
    <>
      <Head>
        <title>DG AI Coach</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#FAF9F5" />
      </Head>
      <div style={s.app}>
        <header style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Avatar kind="coach" size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={s.brand}>DG AI Coach</div>
              <div style={s.sub}>
                {user
                  ? (user.full_name ? `${user.full_name.split(' ')[0]}` : 'Welcome')
                  : 'Connecting…'}
                {user?.streak_count > 0 && <span style={s.streak}> · 🔥 {user.streak_count}d</span>}
                {user?.paired_telegram && <span style={s.pairedBadge}> · linked</span>}
              </div>
            </div>
          </div>

          {user?.xp_level && (
            <Link href="/dashboard" style={s.levelPill} title={`Level ${user.xp_level.level} · ${user.xp_level.xp} XP`}>
              <span style={s.levelPillLevel}>L{user.xp_level.level}</span>
              <div style={s.levelPillBar}>
                <div style={{ ...s.levelPillFill, width: `${Math.round((user.xp_level.progress || 0) * 100)}%` }} />
              </div>
              <span style={s.levelPillXP}>{user.xp_level.xp} XP</span>
            </Link>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              style={s.langPill}
              onClick={() => toggleLanguage()}
              title={user?.preferred_language === 'km' ? 'ប្ដូរទៅអង់គ្លេស' : 'Switch to Khmer'}
              aria-label="Toggle language"
            >
              {user?.preferred_language === 'km' ? 'ខ្មែរ' : 'EN'}
            </button>
            {voiceSupported && (
              <button
                style={{ ...s.iconBtn, color: autoSpeak ? '#C96442' : '#7A7670' }}
                onClick={() => setAutoSpeak(s => !s)}
                title={autoSpeak ? 'Auto-speak on' : 'Auto-speak off'}
                aria-label="Toggle auto-speak"
              >
                {autoSpeak ? '🔊' : '🔈'}
              </button>
            )}
            <button onClick={() => setTopicsOpen(o => !o)} style={s.headerNav} title="Topics" aria-label="Topics">✨</button>
            <Link href="/dashboard" style={s.headerNav} title="Dashboard">📊</Link>
            <Link href="/profile" style={s.headerNav} title="Profile">⚙️</Link>
            <Link href="/end-session" style={s.headerNav} title="End session">👋</Link>
            <button style={s.linkBtn} onClick={() => setPairing(p => !p)}>
              {user?.paired_telegram ? '✓' : '🔗'}
            </button>
            <button
              onClick={() => avatarFileRef.current?.click()}
              style={s.avatarBtn}
              title="Change your avatar"
              aria-label="Upload avatar"
            >
              <Avatar kind="user" size={32} name={user?.full_name} src={user?.avatar_url} />
            </button>
            <input ref={avatarFileRef} type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: 'none' }} />
          </div>
        </header>

        {pairing && (
          <div style={s.pairBox}>
            {user?.paired_telegram ? (
              <div style={{ fontSize: 13, color: '#5A5A55', lineHeight: 1.5 }}>
                ✓ Already linked to <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer" style={s.tgLink}>@dgaicoach_bot</a>. Both surfaces share one history.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2A2925', marginBottom: 6 }}>Link this web chat with Telegram</div>
                <div style={{ fontSize: 12, color: '#5A5A55', marginBottom: 10, lineHeight: 1.5 }}>
                  Pick the direction that fits — both end up with one shared history.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                  <div style={s.linkOption}>
                    <div style={s.linkOptionTitle}>From web → Telegram</div>
                    {!generatedCode ? (
                      <button style={s.linkOptionAction} onClick={generateCode}>
                        Generate code for Telegram
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <code style={s.bigCode}>{generatedCode}</code>
                        <span style={{ fontSize: 12, color: '#5A5A55' }}>
                          Send <a href={`https://t.me/dgaicoach_bot?text=${encodeURIComponent(`/link ${generatedCode}`)}`} target="_blank" rel="noreferrer" style={s.tgLink}>{`/link ${generatedCode}`}</a> in @dgaicoach_bot
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={s.linkOption}>
                    <div style={s.linkOptionTitle}>From Telegram → web</div>
                    <div style={{ fontSize: 12, color: '#5A5A55', marginBottom: 8 }}>
                      Send <code style={s.kbd}>/web</code> in <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer" style={s.tgLink}>@dgaicoach_bot</a>, paste the code here:
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        style={s.codeInput}
                        placeholder="ABC123"
                        value={pairCode}
                        onChange={e => setPairCode(e.target.value.toUpperCase().slice(0, 8))}
                        maxLength={8}
                      />
                      <button style={s.codeBtn} onClick={applyCode}>Link</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div ref={scrollRef} style={s.thread}>
          {messages.length === 0 && !busy && (
            <div style={s.empty}>{t(user?.preferred_language, 'header.connecting')}</div>
          )}

          {/* Topic picker — show when learner is past onboarding and either
              (a) the thread is empty, or (b) they manually opened topics */}
          {user?.status === 'active' && (messages.length <= 2 || topicsOpen) && topics.length > 0 && (
            <div style={s.topicsBlock}>
              <div style={s.topicsHeader}>
                <div style={s.topicsTitle}>
                  {user?.preferred_language === 'km'
                    ? '៙ ប្រធានបទដែលអ្នកអាចចាប់ផ្ដើមពិភាក្សាជាមួយខ្ញុំ'
                    : '✨ Pick a topic to start with'}
                </div>
                {topicsOpen && (
                  <button onClick={() => setTopicsOpen(false)} style={s.topicsClose} aria-label="Close topics">✕</button>
                )}
              </div>
              <div style={s.topicsGrid}>
                {topics.map(tp => (
                  <button
                    key={tp.id}
                    onClick={() => { setTopicsOpen(false); send(tp.prompt); }}
                    style={s.topicChip}
                    disabled={busy}
                  >
                    <span style={s.topicIcon}>{tp.icon}</span>
                    <span style={s.topicLabel}>{tp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageRow key={i} role={m.role} text={m.text} userName={user?.full_name} userAvatar={user?.avatar_url} />
          ))}
          {busy && (
            <div style={s.row}>
              <Avatar kind="coach" size={32} />
              <div style={s.botBubble}>
                <span style={s.typing}>
                  <i style={s.dot} />
                  <i style={{ ...s.dot, animationDelay: '0.15s' }} />
                  <i style={{ ...s.dot, animationDelay: '0.3s' }} />
                </span>
              </div>
            </div>
          )}
        </div>

        {!!suggestions.length && !busy && (
          <div style={s.suggestions}>
            {suggestions.map((sg, i) => (
              <button key={i} style={s.suggestion} onClick={() => send(sg)} disabled={busy}>
                {sg}
              </button>
            ))}
          </div>
        )}

        {attachment && (
          <div style={s.attachmentRow}>
            <img src={attachment.dataUrl} alt="attached" style={s.attachmentThumb} />
            <span style={{ flex: 1, fontSize: 13, color: '#5A5A55' }}>Image attached — coach will analyse it with your message</span>
            <button style={s.attachmentClear} onClick={() => setAttachment(null)} aria-label="Remove attachment">✕</button>
          </div>
        )}

        <form style={s.composer} onSubmit={e => { e.preventDefault(); send(draft); }}>
          <button
            type="button"
            style={s.iconAction}
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title="Attach an image"
            aria-label="Attach image"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 12-7-7-9 9a3 3 0 0 0 4 4l8-8"/></svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />

          {voiceSupported && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={busy}
              style={{ ...s.iconAction, background: recording ? '#C96442' : 'transparent', color: recording ? '#fff' : '#5A5A55' }}
              title={recording ? 'Stop recording' : 'Speak'}
              aria-label="Voice input"
            >
              {recording
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>}
            </button>
          )}

          <textarea
            ref={inputRef}
            style={s.input}
            placeholder={recording ? t(user?.preferred_language, 'composer.listening') : t(user?.preferred_language, 'composer.placeholder')}
            value={draft}
            onChange={e => { setDraft(e.target.value); autoGrow(e.target); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            disabled={busy}
          />
          <button
            type="submit"
            style={{ ...s.sendBtn, opacity: busy || (!draft.trim() && !attachment) ? 0.4 : 1 }}
            disabled={busy || (!draft.trim() && !attachment)}
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M5 12L19 5L12 19L11 13L5 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>

        {error && (
          <div style={s.errorToast} onClick={() => setError(null)}>{error}</div>
        )}

        <style jsx global>{`
          html, body { margin: 0; padding: 0; background: #FAF9F5; }
          @keyframes pulse { 0%, 60%, 100% { opacity: 0.25; } 30% { opacity: 1; } }
          a { color: #C96442; text-decoration: none; border-bottom: 1px solid rgba(201,100,66,0.3); }
          a:hover { border-bottom-color: #C96442; }
          code { background: #F0EEE6; padding: 1px 6px; border-radius: 4px; font-size: 0.92em; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
          ul, ol { margin: 6px 0; padding-left: 22px; }
          li { margin: 3px 0; }
          p { margin: 6px 0; }
          p:first-child { margin-top: 0; } p:last-child { margin-bottom: 0; }
          strong { color: #2A2925; font-weight: 600; }
          textarea:focus, input:focus { outline: none; border-color: #C96442; }
          button { transition: opacity 0.15s, background 0.15s, transform 0.05s, color 0.15s; }
          button:active:not(:disabled) { transform: scale(0.98); }
        `}</style>
      </div>
    </>
  );
}

function MessageRow({ role, text, userName, userAvatar }) {
  const isUser = role === 'user';
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitReport() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/chat/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message_text: text, reason }),
      });
      const j = await r.json();
      if (j.ok) {
        setReported(true);
        setReporting(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...s.row, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <Avatar kind={isUser ? 'user' : 'coach'} size={32} name={isUser ? userName : null} src={isUser ? userAvatar : null} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4, maxWidth: '85%' }}>
        <div style={isUser ? s.userBubble : s.botBubble}>
          {isUser ? (
            <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{text}</ReactMarkdown>
          )}
        </div>

        {!isUser && !reported && !reporting && (
          <button onClick={() => setReporting(true)} style={s.reportLink} title="Report this reply">
            ⚠ Report
          </button>
        )}

        {!isUser && reporting && (
          <div style={s.reportBox}>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 500))}
              placeholder="What's wrong with this reply? (optional)"
              style={s.reportInput}
              rows={2}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={submitReport} disabled={busy} style={s.reportSubmit}>
                {busy ? 'Sending…' : 'Submit'}
              </button>
              <button onClick={() => { setReporting(false); setReason(''); }} style={s.reportCancel}>Cancel</button>
            </div>
          </div>
        )}

        {!isUser && reported && (
          <div style={s.reportThanks}>✓ Reported. Thanks — the team will review.</div>
        )}
      </div>
    </div>
  );
}

const mdComponents = {
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function resizeSquare(dataUrl, size, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

function stripMarkdown(text) {
  return (text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s*/gm, '')
    .replace(/_+/g, '');
}

// ── Anthropic-inspired palette ────────────────────────────────────────────────
const BG       = '#FAF9F5';
const SURFACE  = '#FFFFFF';
const BORDER   = '#EBE8DD';
const TEXT     = '#2A2925';
const MUTED    = '#7A7670';
const ACCENT   = '#C96442';

const s = {
  app:        { display: 'flex', flexDirection: 'column', height: '100dvh', background: BG, fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Inter", sans-serif', color: TEXT, WebkitFontSmoothing: 'antialiased' },
  header:     { padding: '10px 16px', background: BG, borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 5, gap: 8 },
  brand:      { fontWeight: 600, fontSize: 16, letterSpacing: -0.2 },
  sub:        { color: MUTED, fontSize: 12, marginTop: 2 },
  streak:     { color: '#D97706', fontWeight: 600 },
  pairedBadge:{ color: '#059669', fontWeight: 500 },
  iconBtn:    { background: 'transparent', border: 'none', padding: 6, borderRadius: 8, cursor: 'pointer', fontSize: 16, lineHeight: 1 },
  headerNav:  { background: 'transparent', border: 'none', padding: 6, borderRadius: 8, cursor: 'pointer', fontSize: 16, lineHeight: 1, textDecoration: 'none' },
  avatarBtn:  { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%' },
  linkBtn:    { background: SURFACE, border: `1px solid ${BORDER}`, padding: '6px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', color: TEXT, fontWeight: 500 },
  langPill:   { background: SURFACE, border: `1px solid ${BORDER}`, padding: '5px 11px', borderRadius: 999, fontSize: 12, cursor: 'pointer', color: ACCENT, fontWeight: 700, letterSpacing: 0.5, minWidth: 36 },
  reportLink: { background: 'transparent', border: 'none', padding: '2px 6px', fontSize: 11, color: '#9B9690', cursor: 'pointer', marginLeft: 4 },
  reportBox:  { background: '#FFF8F0', border: `1px solid #F5E1D0`, borderRadius: 10, padding: 10, marginLeft: 4, width: 'min(100%, 320px)' },
  reportInput:{ width: '100%', padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' },
  reportSubmit:{ background: '#DC2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  reportCancel:{ background: 'transparent', color: '#5A5A55', border: `1px solid ${BORDER}`, padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' },
  reportThanks:{ fontSize: 11, color: '#059669', marginLeft: 4 },
  topicsBlock:{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, marginBottom: 14 },
  topicsHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  topicsTitle:{ fontSize: 13, fontWeight: 600, color: ACCENT, letterSpacing: 0.3 },
  topicsClose:{ background: 'transparent', border: 'none', fontSize: 14, color: '#9B9690', cursor: 'pointer', padding: 4 },
  topicsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 },
  topicChip:  { display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '10px 12px', background: '#FFFAF0', border: `1px solid #F5E1D0`, borderRadius: 10, cursor: 'pointer', color: TEXT, fontSize: 13, lineHeight: 1.3 },
  topicIcon:  { fontSize: 18, lineHeight: 1, flexShrink: 0 },
  topicLabel: { flex: 1 },
  levelPill:  { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 999, textDecoration: 'none', color: TEXT, cursor: 'pointer' },
  levelPillLevel: { fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: 0.5 },
  levelPillBar: { width: 60, height: 6, background: '#F3F0E7', borderRadius: 999, overflow: 'hidden' },
  levelPillFill:{ height: '100%', background: `linear-gradient(90deg, ${ACCENT}, #D97757)`, transition: 'width 0.5s' },
  levelPillXP:  { fontSize: 11, color: MUTED, fontFamily: 'ui-monospace, monospace' },
  pairBox:    { padding: 14, background: '#FFFAF0', borderBottom: `1px solid ${BORDER}` },
  linkOption: { padding: 12, border: `1px solid ${BORDER}`, borderRadius: 10, background: SURFACE },
  linkOptionTitle: { fontSize: 12, fontWeight: 600, color: ACCENT, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  linkOptionAction: { padding: '8px 14px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  bigCode:    { padding: '6px 12px', background: '#F0EEE6', borderRadius: 8, fontSize: 18, letterSpacing: 4, fontFamily: 'ui-monospace, monospace', fontWeight: 700 },
  tgLink:     { color: ACCENT, fontWeight: 500 },
  kbd:        { background: '#F0EEE6', padding: '2px 6px', borderRadius: 4, fontSize: '0.92em', fontFamily: 'ui-monospace, monospace' },
  codeInput:  { flex: 1, padding: '10px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, letterSpacing: 3, textAlign: 'center', textTransform: 'uppercase', background: SURFACE, fontFamily: 'ui-monospace, monospace' },
  codeBtn:    { padding: '10px 18px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  thread:     { flex: 1, overflowY: 'auto', padding: '20px 16px 8px', maxWidth: 760, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  empty:      { textAlign: 'center', color: MUTED, marginTop: 60, fontSize: 14 },
  row:        { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  userBubble: { maxWidth: 'min(78%, 540px)', padding: '10px 14px', borderRadius: '14px 14px 4px 14px', background: TEXT, color: '#fff', fontSize: 15, lineHeight: 1.5, wordBreak: 'break-word' },
  botBubble:  { maxWidth: 'min(85%, 600px)', padding: '12px 16px', borderRadius: '4px 14px 14px 14px', background: SURFACE, color: TEXT, fontSize: 15, lineHeight: 1.55, wordBreak: 'break-word', border: `1px solid ${BORDER}` },
  typing:     { display: 'inline-flex', gap: 4, alignItems: 'center', height: 18 },
  dot:        { width: 6, height: 6, borderRadius: '50%', background: MUTED, animation: 'pulse 1.2s infinite ease-in-out' },
  suggestions:{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 16px 12px', maxWidth: 760, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  suggestion: { background: SURFACE, border: `1px solid ${BORDER}`, padding: '8px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer', color: TEXT, fontWeight: 500 },
  attachmentRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', maxWidth: 760, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  attachmentThumb: { width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: `1px solid ${BORDER}` },
  attachmentClear: { background: 'transparent', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 18, padding: 4 },
  composer:   { display: 'flex', padding: '10px 16px 16px', background: BG, borderTop: `1px solid ${BORDER}`, gap: 6, alignItems: 'flex-end', maxWidth: 760, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
  iconAction: { background: 'transparent', border: `1px solid ${BORDER}`, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', color: '#5A5A55', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  input:      { flex: 1, padding: '12px 16px', border: `1px solid ${BORDER}`, borderRadius: 18, fontSize: 15, outline: 'none', resize: 'none', maxHeight: 160, fontFamily: 'inherit', lineHeight: 1.5, background: SURFACE, color: TEXT },
  sendBtn:    { background: ACCENT, color: '#fff', border: 'none', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  errorToast: { position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#DC2626', color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', zIndex: 10 },
};
