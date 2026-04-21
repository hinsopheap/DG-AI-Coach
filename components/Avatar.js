// components/Avatar.js — circular avatar for the coach and the learner.

const COACH_BG = 'linear-gradient(135deg, #C96442 0%, #D97757 50%, #E89A6F 100%)';

const PALETTE = [
  '#1F6FEB', '#2DA44E', '#9333EA', '#DB2777', '#EA580C',
  '#0891B2', '#7C3AED', '#059669', '#D97706', '#DC2626',
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

function initials(name) {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join('') || '·';
}

// Default coach photo. If present in /public/coach.jpg it becomes the coach
// avatar everywhere — chat, landing, dashboard. Missing file falls through
// to the gradient sparkle.
const DEFAULT_COACH_PHOTO = '/coach.jpg';

export default function Avatar({ kind, name, size = 32, src = null }) {
  const isCoach = kind === 'coach';
  const text = isCoach ? 'C' : initials(name);
  const bg = isCoach ? COACH_BG : PALETTE[hash(name || 'x') % PALETTE.length];

  const style = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: '50%',
    background: bg,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.42,
    fontWeight: 600,
    letterSpacing: 0,
    boxShadow: isCoach ? '0 0 0 1px rgba(201,100,66,0.15)' : 'none',
    fontFamily: 'system-ui, sans-serif',
    overflow: 'hidden',
  };

  // User-uploaded image (or Telegram profile photo)
  if (src && !isCoach) {
    return (
      <div style={style} aria-label={name || 'You'}>
        <img src={src} alt={name || 'avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }

  // Coach avatar — try /coach.jpg first, fall back to gradient sparkle via onError
  if (isCoach) {
    return (
      <div style={style} aria-label="DG AI Coach">
        <img
          src={src || DEFAULT_COACH_PHOTO}
          alt="Coach"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={(e) => {
            // Swap for the gradient sparkle fallback
            const el = e.currentTarget;
            el.style.display = 'none';
            const parent = el.parentNode;
            if (parent && !parent.querySelector('svg')) {
              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
              svg.setAttribute('viewBox', '0 0 24 24');
              svg.setAttribute('width', String(size * 0.62));
              svg.setAttribute('height', String(size * 0.62));
              svg.setAttribute('fill', 'none');
              svg.innerHTML = '<path d="M12 2.5C12.7 7.2 13.8 8.3 18.5 9C13.8 9.7 12.7 10.8 12 15.5C11.3 10.8 10.2 9.7 5.5 9C10.2 8.3 11.3 7.2 12 2.5Z" fill="white" opacity="0.96" /><path d="M18 14.5C18.4 16.8 18.9 17.3 21.2 17.7C18.9 18.1 18.4 18.6 18 20.9C17.6 18.6 17.1 18.1 14.8 17.7C17.1 17.3 17.6 16.8 18 14.5Z" fill="white" opacity="0.78" />';
              parent.appendChild(svg);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div style={style} aria-label={name || 'You'}>
      {text}
    </div>
  );
}
