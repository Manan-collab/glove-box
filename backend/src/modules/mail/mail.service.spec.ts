import { createTransport } from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

const EMAIL = { subject: 'Hello', html: '<p>Hi</p>', text: 'Hi' };

function configWith(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => values[key]),
  };
}

describe('MailService', () => {
  let sendMail: jest.Mock;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({});
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  const configured = {
    'app.frontendUrl': 'https://glovebox.example',
    'app.nodeEnv': 'development',
    'mail.user': 'sender@gmail.com',
    'mail.appPassword': 'abcdabcdabcdabcd',
  };

  it('sends through Gmail as "Glovebox" when configured', async () => {
    const mail = new MailService(configWith(configured) as any);

    await expect(mail.send('to@example.com', EMAIL)).resolves.toBe(true);
    expect(createTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: { user: 'sender@gmail.com', pass: 'abcdabcdabcdabcd' },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: '"Glovebox" <sender@gmail.com>',
      to: 'to@example.com',
      ...EMAIL,
    });
  });

  it('only logs when credentials are missing', async () => {
    const mail = new MailService(
      configWith({ ...configured, 'mail.appPassword': undefined }) as any,
    );

    await expect(mail.send('to@example.com', EMAIL)).resolves.toBe(false);
    expect(mail.enabled).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('never sends under NODE_ENV=test, even with credentials', async () => {
    const mail = new MailService(
      configWith({ ...configured, 'app.nodeEnv': 'test' }) as any,
    );

    await mail.send('to@example.com', EMAIL);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('swallows SMTP errors instead of throwing', async () => {
    sendMail.mockRejectedValue(new Error('535 bad credentials'));
    const mail = new MailService(configWith(configured) as any);

    await expect(mail.send('to@example.com', EMAIL)).resolves.toBe(false);
  });
});
