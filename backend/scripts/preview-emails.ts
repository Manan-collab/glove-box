// Renders every email template with sample data into .mail-preview/, plus an
// index.html gallery showing each one at desktop and phone width.
//   npm run mail:preview   then open .mail-preview/index.html
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { esc } from '../src/modules/mail/templates/layout';
import { sampleEmails } from './email-samples';

const APP_URL = 'http://localhost:3001';
const OUT_DIR = join(__dirname, '..', '.mail-preview');
// Real emails load the logo from the deployed frontend; point previews at
// the file on disk so they render without the frontend running.
const ICON_PATH = relative(
  OUT_DIR,
  join(__dirname, '..', '..', 'frontend', 'public', 'icon-192.png'),
);

const previews = sampleEmails(APP_URL);

mkdirSync(OUT_DIR, { recursive: true });

const sections = previews.map(({ slug, label, email }) => {
  const html = email.html.replaceAll(`${APP_URL}/icon-192.png`, ICON_PATH);
  writeFileSync(join(OUT_DIR, `${slug}.html`), html);
  writeFileSync(
    join(OUT_DIR, `${slug}.txt`),
    `Subject: ${email.subject}\n\n${email.text}`,
  );
  return `<section>
  <h2>${esc(label)}</h2>
  <p class="subject"><span>Subject</span> ${esc(email.subject)}</p>
  <div class="frames">
    <figure><figcaption>Desktop · 640px</figcaption><iframe width="640" srcdoc="${esc(html)}"></iframe></figure>
    <figure><figcaption>Phone · 375px</figcaption><iframe width="375" srcdoc="${esc(html)}"></iframe></figure>
  </div>
  <details><summary>Plain-text version</summary><pre>${esc(email.text)}</pre></details>
</section>`;
});

writeFileSync(
  join(OUT_DIR, 'index.html'),
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Glovebox emails</title>
<style>
  body { margin: 0; padding: 32px; background: #DDE1EE; font: 14px/1.5 Inter, -apple-system, sans-serif; color: #181A2A; }
  h1 { margin: 0 0 4px; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  h1 span { color: #2F6BFF; }
  section { margin-top: 40px; }
  h2 { margin: 0; font-size: 18px; }
  .subject { margin: 4px 0 12px; color: #5B5E6B; }
  .subject span { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; border: 1px solid #C5CADB; border-radius: 999px; padding: 2px 8px; margin-right: 6px; }
  .frames { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  figure { margin: 0; }
  figcaption { font-size: 12px; color: #5B5E6B; margin-bottom: 6px; }
  iframe { border: 0; border-radius: 12px; background: #EBEEF8; box-shadow: 0 8px 30px rgba(30,41,82,.12); }
  pre { white-space: pre-wrap; background: #fff; padding: 16px; border-radius: 10px; max-width: 640px; }
</style></head>
<body>
<h1>GLOVE<span>BOX</span> emails</h1>
<div>Toggle your OS dark mode to preview the dark variant (Apple Mail behaviour).</div>
${sections.join('\n')}
<script>
  for (const frame of document.querySelectorAll('iframe')) {
    const fit = () => { frame.style.height = frame.contentDocument.documentElement.scrollHeight + 'px'; };
    frame.addEventListener('load', () => { fit(); setTimeout(fit, 400); });
  }
</script>
</body></html>`,
);

console.log(`Wrote ${previews.length} previews to ${OUT_DIR}/index.html`);
