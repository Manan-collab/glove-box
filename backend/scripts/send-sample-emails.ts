// Sends every sample email to a real inbox through the configured Gmail
// account, to check rendering in actual mail clients.
//   npm run mail:send-samples -- you@example.com
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import configuration from '../src/config/configuration';
import { MailService } from '../src/modules/mail/mail.service';
import { sampleEmails } from './email-samples';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: npm run mail:send-samples -- you@example.com');
    process.exit(1);
  }
  const mail = new MailService(new ConfigService(configuration()));
  if (!mail.enabled) {
    console.error(
      'Mail is not configured: set MAIL_USER and MAIL_APP_PASSWORD',
    );
    process.exit(1);
  }
  // Sequential and labelled, so the inbox shows them in gallery order.
  for (const { label, email } of sampleEmails(mail.appUrl)) {
    await mail.send(to, {
      ...email,
      subject: `[Sample: ${label}] ${email.subject}`,
    });
  }
}

void main();
