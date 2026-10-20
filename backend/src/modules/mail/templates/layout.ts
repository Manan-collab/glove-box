// Shared shell for every Glovebox email. Mirrors the web app's design
// language (see frontend/app/theme.ts and opengraph-image.tsx): a dark hero
// with a blue glow, the GLOVE/BOX wordmark, an Inter 800 headline with one
// blue accent phrase, then a light body with a single bordered card.
//
// Email clients are not browsers: layout is tables, styles are inline, and
// anything fancier (web fonts, gradients, dark mode) is a progressive
// enhancement that Gmail and Outlook are free to strip.

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export const COLORS = {
  pageBg: '#EBEEF8',
  paper: '#FFFFFF',
  divider: '#DBDFEC',
  hairline: '#E8EBF3',
  text: '#181A2A',
  textSecondary: '#5B5E6B',
  textDisabled: '#9497A3',
  primary: '#2F6BFF',
  // The hero is always dark, so it uses the dark-scheme palette.
  heroBg: '#14161D',
  heroPaper: '#1C1F28',
  heroDivider: '#2B2E39',
  heroText: '#F2F3F7',
  heroTextSecondary: '#A6A9B6',
  heroAccent: '#5B8CFF',
} as const;

export const FONT_STACK =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LayoutOptions {
  appUrl: string;
  // Inbox preview line shown after the subject; never rendered visibly.
  preheader: string;
  eyebrow: string;
  // Hero headline as two parts so the accent always lands on the second,
  // like "Know what your car / really costs." on the landing page.
  headline: string;
  headlineAccent: string;
  // Defaults to the brand blue; reminders swap in warning/error tones.
  accentColor?: string;
  // Optional one-liner under the headline; skip it when the headline
  // already says everything.
  intro?: string;
  // Pre-rendered, already-escaped HTML for the body.
  body: string;
  footerNote: string;
}

export function renderLayout(opts: LayoutOptions): string {
  const accent = opts.accentColor ?? COLORS.heroAccent;
  const appUrl = opts.appUrl.replace(/\/+$/, '');
  const intro = opts.intro
    ? `\n      <p style="margin:14px 0 0;font-family:${FONT_STACK};font-size:16px;line-height:1.55;font-weight:500;color:${COLORS.heroTextSecondary};">${opts.intro}</p>`
    : '';

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(opts.headline)} ${esc(opts.headlineAccent)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
  a { color: ${COLORS.primary}; }
  @media (max-width: 600px) {
    .gb-px { padding-left: 24px !important; padding-right: 24px !important; }
    .gb-headline { font-size: 30px !important; letter-spacing: -0.8px !important; }
    .gb-stat { font-size: 60px !important; }
  }
  @media (prefers-color-scheme: dark) {
    /* A shade darker than the hero so the card's edge still reads. */
    .gb-page { background-color: #0C0D12 !important; }
    .gb-paper { background-color: ${COLORS.heroPaper} !important; border-color: ${COLORS.heroDivider} !important; }
    .gb-card { border-color: ${COLORS.heroDivider} !important; }
    .gb-line { border-color: ${COLORS.heroDivider} !important; }
    .gb-text { color: ${COLORS.heroText} !important; }
    .gb-muted { color: ${COLORS.heroTextSecondary} !important; }
    .gb-track { background-color: ${COLORS.heroDivider} !important; }
  }
</style>
</head>
<body class="gb-page" style="margin:0;padding:0;background-color:${COLORS.pageBg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(opts.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" class="gb-page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.pageBg};">
<tr><td align="center" style="padding:40px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

    <!-- Hero -->
    <tr><td class="gb-px" bgcolor="${COLORS.heroBg}" style="background-color:${COLORS.heroBg};background-image:radial-gradient(circle at 88% 0%, rgba(91,140,255,0.38) 0%, rgba(91,140,255,0) 60%);border:1px solid ${COLORS.heroDivider};border-bottom:0;border-radius:18px 18px 0 0;padding:28px 40px 40px;font-family:${FONT_STACK};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="28" height="28" bgcolor="${COLORS.primary}" style="width:28px;height:28px;border-radius:7px;background-color:${COLORS.primary};">
          <a href="${esc(appUrl)}" style="text-decoration:none;"><img src="${esc(appUrl)}/icon-192.png" width="28" height="28" alt="G" style="display:block;width:28px;height:28px;border:0;border-radius:7px;color:#FFFFFF;font:800 16px/28px ${FONT_STACK};text-align:center;"></a>
        </td>
        <td style="padding-left:10px;font-family:${FONT_STACK};font-size:15px;font-weight:800;letter-spacing:1px;color:${COLORS.heroText};">
          <a href="${esc(appUrl)}" style="color:${COLORS.heroText};text-decoration:none;">GLOVE<span style="color:${COLORS.heroAccent};">BOX</span></a>
        </td>
      </tr></table>

      <p style="margin:44px 0 0;font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${accent};">${esc(opts.eyebrow)}</p>
      <h1 class="gb-headline" style="margin:10px 0 0;font-family:${FONT_STACK};font-size:36px;line-height:1.1;font-weight:800;letter-spacing:-1.1px;color:${COLORS.heroText};">${esc(opts.headline)}<br><span style="color:${accent};">${esc(opts.headlineAccent)}</span></h1>${intro}
    </td></tr>

    <!-- Body -->
    <tr><td class="gb-paper gb-px" bgcolor="${COLORS.paper}" style="background-color:${COLORS.paper};border:1px solid ${COLORS.divider};border-top:0;border-radius:0 0 18px 18px;padding:36px 40px 40px;font-family:${FONT_STACK};">
      ${opts.body}
    </td></tr>

    <!-- Footer -->
    <tr><td class="gb-px" style="padding:24px 40px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${COLORS.textDisabled};text-align:center;">
      <p class="gb-muted" style="margin:0;color:${COLORS.textDisabled};">${opts.footerNote}</p>
      <p style="margin:8px 0 0;">
        <a href="${esc(appUrl)}" style="color:${COLORS.textDisabled};font-weight:800;letter-spacing:0.6px;text-decoration:none;">GLOVE<span style="color:${COLORS.primary};">BOX</span></a>
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------- Building blocks for the body ----------

// A single bordered card; each email has at most one.
export function card(inner: string): string {
  return `<table role="presentation" class="gb-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${COLORS.divider};border-radius:14px;"><tr><td style="padding:4px 22px;font-family:${FONT_STACK};">
${inner}
</td></tr></table>`;
}

export interface Line {
  label: string;
  hint?: string;
  value?: string;
}

// Plain rows split by hairlines — the quiet version of the dashboard's lists.
export function lines(
  rows: Line[],
  opts: { firstDivider?: boolean } = {},
): string {
  return rows
    .map((row, i) => {
      const divider =
        i > 0 || opts.firstDivider
          ? `border-top:1px solid ${COLORS.hairline};`
          : '';
      const hint = row.hint
        ? `<div class="gb-muted" style="margin-top:2px;font-size:13px;color:${COLORS.textSecondary};">${esc(row.hint)}</div>`
        : '';
      const value = row.value
        ? `<td align="right" valign="top" class="gb-text gb-line" style="${divider}padding:14px 0 14px 12px;font-size:14.5px;font-weight:700;color:${COLORS.text};white-space:nowrap;">${esc(row.value)}</td>`
        : '';
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
  <td class="gb-line" style="${divider}padding:14px 0;font-family:${FONT_STACK};"><div class="gb-text" style="font-size:14.5px;font-weight:600;color:${COLORS.text};">${esc(row.label)}</div>${hint}</td>${value}
</tr></table>`;
    })
    .join('\n');
}

// Bulletproof button: the whole cell is the hit target, and it still renders
// as a blue block in Outlook, which ignores border-radius.
export function button(label: string, href: string, top = 32): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:${top}px;"><tr>
  <td bgcolor="${COLORS.primary}" style="border-radius:9px;background-color:${COLORS.primary};">
    <a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:9px;">${esc(label)} &nbsp;&rarr;</a>
  </td>
</tr></table>`;
}

// The one small, muted line an email gets under its button.
export function note(html: string, top = 20): string {
  return `<p class="gb-muted" style="margin:${top}px 0 0;font-family:${FONT_STACK};font-size:13.5px;line-height:1.6;color:${COLORS.textSecondary};">${html}</p>`;
}

// ---------- Shared people/garage pieces (friend emails) ----------

export interface PersonSummary {
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
}

export interface GarageCar {
  make: string;
  model: string;
  year: number;
  variant: string;
  fuelType: string;
}

export function nameOf(person: PersonSummary): string {
  return person.displayName?.trim() || person.username;
}

export function firstNameOf(person: PersonSummary): string {
  return nameOf(person).split(/\s+/)[0];
}

function initialsOf(person: PersonSummary): string {
  const parts = nameOf(person).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function carTitle(
  car: Pick<GarageCar, 'make' | 'model' | 'year'>,
): string {
  return `${car.make} ${car.model} ${car.year}`;
}

const MAX_GARAGE_ROWS = 3;

// One card: who they are, then the cars in their public garage.
export function personCard(person: PersonSummary, cars: GarageCar[]): string {
  const avatar = person.avatarUrl
    ? `<img src="${esc(person.avatarUrl)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:50%;border:0;">`
    : `<div style="width:44px;height:44px;border-radius:50%;background-color:${COLORS.primary};color:#FFFFFF;font-family:${FONT_STACK};font-size:16px;font-weight:800;line-height:44px;text-align:center;">${esc(initialsOf(person))}</div>`;
  const count =
    cars.length === 0
      ? 'No cars yet'
      : `${cars.length} ${cars.length === 1 ? 'car' : 'cars'}`;

  const header = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
  <td width="44" style="padding:16px 0;">${avatar}</td>
  <td style="padding:16px 0 16px 14px;font-family:${FONT_STACK};">
    <div class="gb-text" style="font-size:16px;font-weight:700;color:${COLORS.text};">${esc(nameOf(person))}</div>
    <div class="gb-muted" style="margin-top:1px;font-size:13px;color:${COLORS.textSecondary};">@${esc(person.username)} &nbsp;·&nbsp; ${count}</div>
  </td>
</tr></table>`;

  const rows: Line[] = cars.slice(0, MAX_GARAGE_ROWS).map((car) => ({
    label: carTitle(car),
    hint: `${car.variant} · ${car.fuelType}`,
  }));
  const more = cars.length - MAX_GARAGE_ROWS;
  if (more > 0) rows.push({ label: `+ ${more} more` });

  return card(
    header + (rows.length ? '\n' + lines(rows, { firstDivider: true }) : ''),
  );
}

export function garageText(cars: GarageCar[]): string {
  return cars
    .slice(0, MAX_GARAGE_ROWS)
    .map((car) => `  - ${carTitle(car)} (${car.variant}, ${car.fuelType})`)
    .concat(
      cars.length > MAX_GARAGE_ROWS
        ? [`  - +${cars.length - MAX_GARAGE_ROWS} more`]
        : [],
    )
    .join('\n');
}

export function textFooter(appUrl: string): string {
  return `—\nGlovebox · Know what your car really costs.\n${appUrl.replace(/\/+$/, '')}`;
}
