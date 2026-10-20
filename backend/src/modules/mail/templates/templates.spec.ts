import { renderFriendRequestAcceptedEmail } from './friend-request-accepted.template';
import { renderFriendRequestReceivedEmail } from './friend-request-received.template';
import {
  renderInsuranceExpiryEmail,
  toneFor,
} from './insurance-expiry.template';
import { renderWelcomeEmail } from './welcome.template';

const appUrl = 'https://glovebox.example/';
const user = { displayName: 'Manan Mer', username: 'manan', avatarUrl: null };
const car = {
  id: 'car-1',
  make: 'Hyundai',
  model: 'Creta',
  year: 2022,
  variant: 'SX(O)',
  fuelType: 'Petrol',
};

describe('mail templates', () => {
  it('escapes user-controlled names in the HTML', () => {
    const sender = {
      displayName: '<script>alert(1)</script>',
      username: 'evil',
      avatarUrl: null,
    };
    const { html, subject } = renderFriendRequestReceivedEmail({
      appUrl,
      recipient: user,
      sender,
      senderCars: [],
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    // Subjects are plain text headers, not HTML.
    expect(subject).toBe('<script>alert(1)</script> wants to see your garage');
  });

  it('falls back to the username when there is no display name', () => {
    const { subject, text } = renderWelcomeEmail({
      appUrl,
      user: { ...user, displayName: null },
    });

    expect(subject).toBe('Welcome to Glovebox, manan. Your garage is open');
    expect(text).toContain('https://glovebox.example/dashboard');
  });

  it("links the accepted email to the accepter's garage", () => {
    const { html } = renderFriendRequestAcceptedEmail({
      appUrl,
      recipient: user,
      accepter: {
        displayName: 'Priya K',
        username: 'priya.k',
        avatarUrl: null,
      },
      accepterCars: [car],
    });

    expect(html).toContain(
      'https://glovebox.example/dashboard/friends/priya.k',
    );
    expect(html).toContain('Hyundai Creta 2022');
  });

  describe('insurance expiry', () => {
    const render = (daysLeft: number) =>
      renderInsuranceExpiryEmail({
        appUrl,
        user,
        car,
        expiryDate: new Date(Date.UTC(2026, 9, 27)),
        daysLeft,
      });

    it.each([
      [30, 'info'],
      [8, 'info'],
      [7, 'warning'],
      [2, 'warning'],
      [1, 'error'],
      [0, 'error'],
    ])('uses the right tone %i days out', (daysLeft, tone) => {
      expect(toneFor(daysLeft)).toBe(tone);
    });

    it('words the subject by urgency', () => {
      expect(render(30).subject).toBe("Your Creta's insurance ends in 30 days");
      expect(render(7).subject).toBe("7 days left on your Creta's insurance");
      expect(render(1).subject).toBe("⚠️ Your Creta's insurance ends tomorrow");
      expect(render(0).subject).toBe("⚠️ Your Creta's insurance ends today");
    });

    it('formats the expiry as a calendar date, not a local time', () => {
      expect(render(7).text).toContain('Tue, 27 Oct, 2026');
    });

    it('only adds the legal note on the last reminder', () => {
      expect(render(7).html).not.toContain('Motor Vehicles Act');
      expect(render(1).html).toContain('Motor Vehicles Act');
    });
  });
});
