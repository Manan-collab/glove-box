import {
  COLORS,
  FONT_STACK,
  PersonSummary,
  RenderedEmail,
  button,
  esc,
  firstNameOf,
  note,
  renderLayout,
  textFooter,
} from './layout';

export interface WelcomeEmailData {
  appUrl: string;
  user: PersonSummary;
}

const STEPS = [
  {
    title: 'Add your car',
    body: 'Make, model and variant fill in as you type.',
  },
  {
    title: 'Log what you spend',
    body: 'Fuel, service, repairs, tyres, insurance, mods.',
  },
  { title: 'See the real cost', body: 'Per month, per km and per category.' },
];

function step(index: number, s: (typeof STEPS)[number]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${index > 0 ? 'margin-top:20px;' : ''}"><tr>
  <td width="44" valign="top">
    <div style="width:30px;height:30px;border-radius:50%;background-color:${COLORS.primary};color:#FFFFFF;font-family:${FONT_STACK};font-size:13px;font-weight:800;line-height:30px;text-align:center;">${index + 1}</div>
  </td>
  <td valign="top" style="font-family:${FONT_STACK};">
    <div class="gb-text" style="font-size:15.5px;font-weight:700;line-height:1.3;color:${COLORS.text};">${esc(s.title)}</div>
    <div class="gb-muted" style="margin-top:3px;font-size:14px;line-height:1.5;color:${COLORS.textSecondary};">${esc(s.body)}</div>
  </td>
</tr></table>`;
}

export function renderWelcomeEmail(data: WelcomeEmailData): RenderedEmail {
  const appUrl = data.appUrl.replace(/\/+$/, '');
  const firstName = firstNameOf(data.user);
  const username = data.user.username;

  const body = [
    STEPS.map((s, i) => step(i, s)).join('\n'),
    button('Add your first car', `${appUrl}/dashboard`),
    note(
      `Friends can find you as <strong class="gb-text" style="color:${COLORS.text};">@${esc(username)}</strong>. They see your cars, never your expenses.`,
      24,
    ),
  ].join('\n');

  const html = renderLayout({
    appUrl,
    preheader: `Add your car, log what you spend, and see what it really costs per km.`,
    eyebrow: 'Welcome aboard',
    headline: 'Your garage',
    headlineAccent: 'is open.',
    intro: `Hey ${esc(firstName)}, let's find out what your car really costs.`,
    body,
    footerNote: `A one-time welcome for @${esc(username)}.`,
  });

  const text = `Hey ${firstName}, welcome to Glovebox. Your garage is open.

${STEPS.map((s, i) => `  ${i + 1}. ${s.title}: ${s.body}`).join('\n')}

Add your first car: ${appUrl}/dashboard

Friends can find you as @${username}. They see your cars, never your expenses.

${textFooter(appUrl)}`;

  return {
    subject: `Welcome to Glovebox, ${firstName}. Your garage is open`,
    html,
    text,
  };
}
