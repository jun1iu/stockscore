import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

const C = { bg: '#07100c', panel: '#0f1c16', line: '#2b4538', text: '#e9f1ec', muted: '#94a89d', accent: '#3ee08a' };

/** The share card: brand, a headline, a line of context and, for a company, its score. */
export function ogImage({ eyebrow, title, detail, score }: { eyebrow: string; title: string; detail: string; score?: number }) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: C.bg, color: C.text }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 34, fontWeight: 700 }}>
          <svg width="40" height="40" viewBox="0 0 20 20" style={{ marginRight: 16 }}>
            <rect x="1" y="11" width="4" height="8" rx="1" fill={C.accent} />
            <rect x="8" y="6" width="4" height="13" rx="1" fill={C.accent} />
            <rect x="15" y="1" width="4" height="18" rx="1" fill={C.accent} />
          </svg>
          StockScore
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: score === undefined ? 1000 : 720 }}>
            <div style={{ display: 'flex', fontSize: 28, color: C.accent, marginBottom: 16 }}>{eyebrow}</div>
            <div style={{ display: 'flex', fontSize: score === undefined ? 76 : 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          </div>
          {score !== undefined && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 260, height: 260, borderRadius: 130, border: `14px solid ${C.text}`, background: C.panel }}>
              <div style={{ display: 'flex', fontSize: 112, fontWeight: 800, lineHeight: 1 }}>{Math.round(score)}</div>
              <div style={{ display: 'flex', fontSize: 28, color: C.muted }}>/100</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: C.muted, borderTop: `2px solid ${C.line}`, paddingTop: 28 }}>{detail}</div>
      </div>
    ),
    OG_SIZE,
  );
}
