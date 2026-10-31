// Pure helpers for the offers collector (no network, no Firestore), so they can be tested offline.

export const CATEGORIES = ['groceries', 'dining', 'travel', 'shopping', 'instalments', 'fuel_bills', 'health', 'online', 'other'];

// Same normalisation as offerContentKey() in index.html, so the app and the collector agree on
// whether two offers are the same one.
export function contentKey(o) {
  const norm = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return [o.issuer, o.merchant, o.validUntil, o.discountText].map(norm).join('|');
}

export function merchantKey(o) {
  return String(o.issuer || '') + '|' + String(o.merchant || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Today's date in Sri Lanka, as YYYY-MM-DD
export function todayInColombo(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: '-', mdash: '-', hellip: '...' };

function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Reduce a page to readable text. Links are kept as "text [absolute-url]" so the model can
// return each offer's own detail link.
export function htmlToText(html, baseUrl) {
  let s = String(html || '');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(script|style|noscript|svg|iframe|template)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<(nav|footer)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    let abs = '';
    try { abs = new URL(decodeEntities(href), baseUrl).href; } catch (e) { abs = ''; }
    if (!text) return ' ';
    return /^https?:/i.test(abs) ? ` ${text} [${abs}] ` : ` ${text} `;
  });
  s = s.replace(/<(br|hr)\b[^>]*>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|tr|section|article|dd|dt)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return s.split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');
}

// Split long page text on line boundaries so each request stays a sensible size
export function chunkText(text, maxChars = 50000) {
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if (cur.length + line.length + 1 > maxChars && cur) { chunks.push(cur); cur = ''; }
    cur += (cur ? '\n' : '') + line.slice(0, maxChars);
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// A redirect must stay on the bank's own site, over https: the configured host or one of its subdomains
// (www.combank.lk -> combank.lk and back counts as the same site). Anything else is refused.
export function sameSite(finalUrl, sourceUrl) {
  try {
    const f = new URL(finalUrl), s = new URL(sourceUrl);
    if (f.protocol !== 'https:') return false;
    const base = s.hostname.replace(/^www\./, '');
    return f.hostname === base || f.hostname.endsWith('.' + base);
  } catch (e) {
    return false;
  }
}

// Minimal robots.txt check for our user agent (or *): is this path disallowed?
export function robotsDisallows(robotsTxt, pathname, agentToken = 'serendib') {
  let applies = false, sawAgentInGroup = false;
  const rules = [];
  for (const raw of String(robotsTxt || '').split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!sawAgentInGroup) applies = false;
      sawAgentInGroup = true;
      if (val === '*' || val.toLowerCase().includes(agentToken)) applies = true;
    } else {
      sawAgentInGroup = false;
      if (applies && (key === 'disallow' || key === 'allow') && val) rules.push({ allow: key === 'allow', path: val });
    }
  }
  // Longest matching rule wins
  let best = null;
  for (const r of rules) {
    if (pathname.startsWith(r.path) && (!best || r.path.length > best.path.length)) best = r;
  }
  return !!best && !best.allow;
}

function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const clip = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Turn one extracted offer into the stored shape, or explain why it was skipped
export function toOffer(x, source, today) {
  const headline = clip(x.headline, 120);
  if (!headline) return { skip: 'no headline' };
  const validUntil = isRealDate(x.validUntil) ? x.validUntil : '';
  if (x.validUntil && !validUntil) return { skip: 'bad end date' };
  if (validUntil && validUntil < today) return { skip: 'already ended' };
  const validFrom = isRealDate(x.validFrom) ? x.validFrom : '';
  const category = CATEGORIES.includes(x.category) ? x.category : 'other';
  // The offer's own link, only on the bank's site (page text could steer the model to another address)
  const detail = typeof x.detailUrl === 'string' && sameSite(x.detailUrl, source.url) ? x.detailUrl : '';
  const minSpend = typeof x.minSpend === 'number' && Number.isFinite(x.minSpend) && x.minSpend > 0 ? x.minSpend : null;
  const offer = {
    issuer: source.issuer,
    bank: source.bank,
    merchant: clip(x.merchant, 80),
    headline,
    details: clip(x.details, 300),
    discountText: clip(x.discountText, 40),
    category,
    cardScope: {
      allCards: !!x.allCards,
      networks: (x.networks || []).map((n) => clip(n, 30)).filter(Boolean).slice(0, 6),
      tiers: (x.tiers || []).map((t) => clip(t, 30)).filter(Boolean).slice(0, 8),
      text: x.allCards ? '' : clip(x.eligibleCards, 120)
    },
    validFrom,
    validUntil,
    days: clip(x.days, 60),
    minSpend,
    terms: String(x.terms || '').trim().slice(0, 600),
    sourceUrl: detail || source.url,
    sourceTitle: source.bank + ' offers'
  };
  offer.contentKey = contentKey(offer);
  return { offer };
}

// Decide what to write, given what's already in Firestore.
//   published: [{ id, ...data }] with status "published"
//   drafts:    [{ id, ...data }] any status (pending or rejected)
// Returns { verify: [publishedId], newDrafts: [{ id, data }], expire: [publishedId] }
export function planChanges({ published, drafts, extracted, today, now = new Date().toISOString(), draftId }) {
  const pubByKey = new Map();
  const pubByMerchant = new Map();
  for (const p of published) {
    pubByKey.set(p.contentKey || contentKey(p), p);
    if (p.merchant) pubByMerchant.set(merchantKey(p), p);
  }
  const draftKeys = new Set(drafts.map((d) => d.contentKey || contentKey(d)));
  const verify = new Set();
  const newDrafts = [];
  const seen = new Set();
  for (const o of extracted) {
    if (seen.has(o.contentKey)) continue;
    seen.add(o.contentKey);
    const same = pubByKey.get(o.contentKey);
    if (same) { verify.add(same.id); continue; }
    if (draftKeys.has(o.contentKey)) continue; // already waiting for review, or rejected
    const prev = o.merchant ? pubByMerchant.get(merchantKey(o)) : null;
    const data = Object.assign({}, o, {
      status: 'pending',
      change: prev ? 'updated' : 'new',
      extractedAt: now
    });
    if (prev) {
      data.targetId = prev.id;
      data.previous = { headline: prev.headline || '', discountText: prev.discountText || '', validUntil: prev.validUntil || '' };
    }
    newDrafts.push({ id: draftId(o.contentKey), data });
  }
  const expire = published.filter((p) => p.validUntil && p.validUntil < today).map((p) => p.id);
  return { verify: [...verify], newDrafts, expire };
}
