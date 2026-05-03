// lib/email.js — outbound email via Resend.
//
// Set RESEND_API_KEY in env to enable. Without a key, sendEmail is a no-op
// that returns { ok: false, reason: 'not_configured' } — every caller MUST
// be tolerant of this. Email is a soft enhancement, never a hard
// dependency.
//
// FROM address defaults to "DG AI Coach <onboarding@resend.dev>" which is
// allowed without domain verification but only delivers to the email tied
// to the Resend account. To deliver to anyone, set EMAIL_FROM to an
// address on a verified domain (https://resend.com/domains).

const RESEND_URL = 'https://api.resend.com/emails';

function token() {
  return process.env.RESEND_API_KEY;
}

function fromAddress() {
  return process.env.EMAIL_FROM || 'DG AI Coach <onboarding@resend.dev>';
}

export function isEmailEnabled() {
  return !!token();
}

export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!token()) return { ok: false, reason: 'not_configured' };
  if (!to || !subject) return { ok: false, reason: 'missing_args' };

  try {
    const res = await fetch(RESEND_URL, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     fromAddress(),
        to:       Array.isArray(to) ? to : [to],
        subject,
        html:     html || `<pre>${escapeHtml(text || '')}</pre>`,
        text:     text || stripTags(html || ''),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] Resend failed:', res.status, body.slice(0, 200));
      return { ok: false, reason: 'resend_error', status: res.status };
    }
    const data = await res.json();
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('[email] fetch error:', err.message);
    return { ok: false, reason: err.message };
  }
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Templates ────────────────────────────────────────────────────────────────

export function welcomeEmail({ name, baseUrl }) {
  const first = (name || '').split(' ')[0] || 'friend';
  const url = baseUrl || 'https://dgaicoach.vercel.app';
  return {
    subject: `Welcome to DG AI Coach, ${first}`,
    html: wrap(`
      <h1 style="font-size:22px;margin:0 0 12px">Welcome, ${escapeHtml(first)}.</h1>
      <p>You're in. Five focused minutes a day to apply AI to your real work.</p>
      <p style="margin:24px 0">
        <a href="${url}/chat" style="background:#C96442;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:500">Open the coach →</a>
      </p>
      <p>Two surfaces, one history:</p>
      <ul>
        <li><a href="${url}/chat">Web chat</a> — bookmark it on your phone home screen</li>
        <li><a href="https://t.me/dgaicoach_bot">@dgaicoach_bot</a> on Telegram — send <code>/web</code> in there to pair both surfaces</li>
      </ul>
      <p>Tap <a href="${url}/topics">Topics</a> if you want a starter prompt.</p>
      <hr style="border:none;border-top:1px solid #EBE8DD;margin:32px 0" />
      <p style="font-size:13px;color:#7A7670">
        — Hin Sopheap, DG Academy / Cambodia AI Group<br/>
        <a href="${url}/privacy" style="color:#7A7670">Privacy</a> · <a href="${url}/terms" style="color:#7A7670">Terms</a>
      </p>
    `),
    text: `Welcome, ${first}.

You're in. Five focused minutes a day to apply AI to your real work.

Open the coach: ${url}/chat
Telegram: https://t.me/dgaicoach_bot (send /web to pair surfaces)
Topics: ${url}/topics

— Hin Sopheap, DG Academy / Cambodia AI Group
${url}/privacy | ${url}/terms`,
  };
}

export function passwordResetEmail({ name, link }) {
  const first = (name || '').split(' ')[0] || 'friend';
  return {
    subject: 'Reset your DG AI Coach password',
    html: wrap(`
      <h1 style="font-size:20px;margin:0 0 12px">Hi ${escapeHtml(first)},</h1>
      <p>You (or someone) asked to reset your password. Click the button below within 30 minutes to set a new one.</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#C96442;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:500">Set a new password</a>
      </p>
      <p style="font-size:13px;color:#7A7670">If this wasn't you, ignore this email — the link expires automatically.</p>
    `),
    text: `Hi ${first},

You (or someone) asked to reset your DG AI Coach password.

Click here within 30 minutes to set a new password:
${link}

If this wasn't you, ignore this email — the link expires automatically.`,
  };
}

export function teamInviteEmail({ inviterName, orgName, code, baseUrl }) {
  const url = baseUrl || 'https://dgaicoach.vercel.app';
  return {
    subject: `${inviterName} invited you to ${orgName} on DG AI Coach`,
    html: wrap(`
      <h1 style="font-size:20px;margin:0 0 12px">You're invited to <strong>${escapeHtml(orgName)}</strong></h1>
      <p>${escapeHtml(inviterName)} invited you to join their team on DG AI Coach — five focused minutes a day to apply AI to your real work.</p>
      <p style="margin:24px 0">Use this team code when you sign up:</p>
      <div style="background:#FFF8F0;border:1px solid #F5E1D0;padding:14px 18px;border-radius:10px;font-size:20px;font-family:monospace;letter-spacing:3px;text-align:center;font-weight:700;color:#C96442">${escapeHtml(code)}</div>
      <p style="margin:24px 0">
        <a href="${url}/signup?org=${encodeURIComponent(code)}" style="background:#C96442;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:500">Sign up & join</a>
      </p>
      <p style="font-size:13px;color:#7A7670">Or sign up at ${url}/signup and paste the code on your profile page.</p>
    `),
    text: `${inviterName} invited you to join ${orgName} on DG AI Coach.

Team code: ${code}

Sign up + join: ${url}/signup?org=${encodeURIComponent(code)}

Or sign up at ${url}/signup and paste the code on your profile page.`,
  };
}

function wrap(inner) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>DG AI Coach</title></head>
<body style="margin:0;padding:0;background:#FAF9F5;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#2A2925">
  <div style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border:1px solid #EBE8DD;border-radius:16px;line-height:1.6;font-size:15px">
    ${inner}
  </div>
</body></html>`;
}
