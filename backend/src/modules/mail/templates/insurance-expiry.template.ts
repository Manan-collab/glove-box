import {
  COLORS,
  FONT_STACK,
  GarageCar,
  Line,
  PersonSummary,
  RenderedEmail,
  button,
  card,
  carTitle,
  esc,
  firstNameOf,
  lines,
  note,
  renderLayout,
  textFooter,
} from './layout';

export interface InsuranceExpiryEmailData {
  appUrl: string;
  user: PersonSummary;
  car: GarageCar & { id: string };
  expiryDate: Date;
  // Whole days from "today" (the reminder run) to expiryDate; 0 = today.
  daysLeft: number;
  // Most recent INSURANCE expense on this car, if one was logged.
  lastRenewal?: { amount: number; currency: string; date: Date } | null;
}

type Tone = 'info' | 'warning' | 'error';

// Hero colours come from the dark palette, body colours from the light one,
// matching primary/warning/error in frontend/app/theme.ts.
const TONES: Record<Tone, { hero: string; body: string; eyebrow: string }> = {
  info: { hero: '#5B8CFF', body: '#2F6BFF', eyebrow: 'Insurance reminder' },
  warning: { hero: '#F2B84E', body: '#C98A1F', eyebrow: 'Renewal due soon' },
  error: { hero: '#F16A70', body: '#D5454C', eyebrow: 'Last chance to renew' },
};

// The countdown bar spans the first reminder's window.
const WINDOW_DAYS = 30;

export function toneFor(daysLeft: number): Tone {
  if (daysLeft <= 1) return 'error';
  if (daysLeft <= 7) return 'warning';
  return 'info';
}

function whenPhrase(daysLeft: number): string {
  if (daysLeft <= 0) return 'today';
  if (daysLeft === 1) return 'tomorrow';
  return `in ${daysLeft} days`;
}

// Dates are calendar dates stored at UTC midnight; formatting in UTC keeps
// "27 Oct" from becoming "26 Oct" west of Greenwich.
function formatDate(date: Date, withWeekday = false): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    ...(withWeekday && { weekday: 'short' }),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function countdown(daysLeft: number, toneColor: string): string {
  const big = daysLeft <= 0 ? 'Today' : String(daysLeft);
  const unit =
    daysLeft <= 0
      ? 'last day of cover'
      : daysLeft === 1
        ? 'day left'
        : 'days left';
  const fill = Math.round(
    Math.min(1, Math.max(0.04, (WINDOW_DAYS - daysLeft) / WINDOW_DAYS)) * 100,
  );
  const bar =
    fill >= 100
      ? `<td bgcolor="${toneColor}" style="height:6px;border-radius:999px;background-color:${toneColor};font-size:0;line-height:0;">&nbsp;</td>`
      : `<td width="${fill}%" bgcolor="${toneColor}" style="height:6px;border-radius:999px 0 0 999px;background-color:${toneColor};font-size:0;line-height:0;">&nbsp;</td>
    <td class="gb-track" width="${100 - fill}%" bgcolor="${COLORS.hairline}" style="height:6px;border-radius:0 999px 999px 0;background-color:${COLORS.hairline};font-size:0;line-height:0;">&nbsp;</td>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:20px 0 22px;font-family:${FONT_STACK};">
  <span class="gb-stat" style="font-size:68px;line-height:1;font-weight:800;letter-spacing:-2.5px;color:${toneColor};">${big}</span>
  <span class="gb-muted" style="padding-left:8px;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${COLORS.textSecondary};">${unit}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;"><tr>
    ${bar}
  </tr></table>
</td></tr></table>`;
}

export function renderInsuranceExpiryEmail(
  data: InsuranceExpiryEmailData,
): RenderedEmail {
  const appUrl = data.appUrl.replace(/\/+$/, '');
  const toneKey = toneFor(data.daysLeft);
  const tone = TONES[toneKey];
  const when = whenPhrase(data.daysLeft);
  const model = data.car.model;
  const carUrl = `${appUrl}/dashboard/cars/${encodeURIComponent(data.car.id)}`;

  const rows: Line[] = [
    {
      label: carTitle(data.car),
      hint: `${data.car.variant} · ${data.car.fuelType}`,
    },
    { label: 'Cover ends', value: formatDate(data.expiryDate, true) },
  ];
  if (data.lastRenewal) {
    rows.push({
      label: 'Last premium',
      hint: `Paid ${formatDate(data.lastRenewal.date)}`,
      value: formatMoney(data.lastRenewal.amount, data.lastRenewal.currency),
    });
  }

  const legal =
    toneKey === 'error'
      ? ' Driving uninsured is an offence under the Motor Vehicles Act.'
      : '';

  const body = [
    card(
      countdown(data.daysLeft, tone.body) +
        '\n' +
        lines(rows, { firstDivider: true }),
    ),
    button('Update insurance details', carUrl),
    note(
      `Already renewed? Log the premium and set the new expiry date, and we'll stop reminding you.${legal}`,
    ),
  ].join('\n');

  const html = renderLayout({
    appUrl,
    preheader: `Cover on your ${carTitle(data.car)} ends ${when} (${formatDate(data.expiryDate)}).`,
    eyebrow: tone.eyebrow,
    accentColor: tone.hero,
    headline: `Your ${model}'s insurance`,
    headlineAccent: `ends ${when}.`,
    body,
    footerNote: `Sent to @${esc(data.user.username)}. Reminders go out 30, 7 and 1 day before expiry.`,
  });

  const subject =
    data.daysLeft <= 1
      ? `⚠️ Your ${model}'s insurance ends ${when}`
      : data.daysLeft <= 7
        ? `${data.daysLeft} days left on your ${model}'s insurance`
        : `Your ${model}'s insurance ends in ${data.daysLeft} days`;

  const text = `Hey ${firstNameOf(data.user)},

The insurance on your ${carTitle(data.car)} (${data.car.variant}) ends ${when}, on ${formatDate(data.expiryDate, true)}.${
    data.lastRenewal
      ? `\nLast premium: ${formatMoney(data.lastRenewal.amount, data.lastRenewal.currency)}, paid ${formatDate(data.lastRenewal.date)}.`
      : ''
  }

Update insurance details: ${carUrl}

Already renewed? Log the premium and set the new expiry date, and we'll stop reminding you.${legal}

${textFooter(appUrl)}`;

  return { subject, html, text };
}
