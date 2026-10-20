import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { RenderedEmail } from './templates/layout';

const FROM_NAME = 'Glovebox';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | null;
  readonly appUrl: string;

  constructor(config: ConfigService) {
    this.appUrl = config.getOrThrow<string>('app.frontendUrl');
    const user = config.get<string>('mail.user');
    const pass = config.get<string>('mail.appPassword');
    // e2e tests boot the real AppModule against the real .env; never let
    // them email their @example.com fixture users through a real inbox.
    const isTest = config.get<string>('app.nodeEnv') === 'test';

    if (user && pass && !isTest) {
      this.transporter = createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
      this.from = `"${FROM_NAME}" <${user}>`;
    } else {
      this.transporter = null;
      this.from = null;
    }
  }

  get enabled(): boolean {
    return this.transporter !== null;
  }

  // Never throws: email is a side effect, and a Gmail outage must not fail
  // the sign-in or friend request that triggered it. Callers fire and
  // forget (`void this.mail.send(...)`). Returns whether it was delivered.
  async send(to: string, email: RenderedEmail): Promise<boolean> {
    if (!this.transporter) {
      this.logger.log(`[mail disabled] to=${to} subject="${email.subject}"`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.from!,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      this.logger.log(`Sent "${email.subject}" to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send "${email.subject}" to ${to}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  // Checks the SMTP login without sending anything.
  async verify(): Promise<void> {
    if (!this.transporter) throw new Error('Mail is not configured');
    await this.transporter.verify();
  }
}
