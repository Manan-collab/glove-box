// Sample data for the email templates, shared by the preview gallery
// (mail:preview) and the real-inbox test send (mail:send-samples).
import { RenderedEmail } from '../src/modules/mail/templates/layout';
import { renderWelcomeEmail } from '../src/modules/mail/templates/welcome.template';
import { renderFriendRequestReceivedEmail } from '../src/modules/mail/templates/friend-request-received.template';
import { renderFriendRequestAcceptedEmail } from '../src/modules/mail/templates/friend-request-accepted.template';
import { renderInsuranceExpiryEmail } from '../src/modules/mail/templates/insurance-expiry.template';

export interface SampleEmail {
  slug: string;
  label: string;
  email: RenderedEmail;
}

export function sampleEmails(appUrl: string): SampleEmail[] {
  const manan = {
    displayName: 'Manan Mer',
    username: 'mananmer9769',
    avatarUrl: null,
  };
  const priya = {
    displayName: 'Priya Kulkarni',
    username: 'priya.k',
    avatarUrl: null,
  };
  const priyaCars = [
    {
      make: 'Mahindra',
      model: 'Thar',
      year: 2023,
      variant: 'LX Hard Top AT',
      fuelType: 'Diesel',
    },
    {
      make: 'Maruti Suzuki',
      model: 'Swift',
      year: 2019,
      variant: 'ZXi Plus',
      fuelType: 'Petrol',
    },
    {
      make: 'Royal Enfield',
      model: 'Himalayan',
      year: 2024,
      variant: '450',
      fuelType: 'Petrol',
    },
    {
      make: 'Honda',
      model: 'City',
      year: 2015,
      variant: 'VX CVT',
      fuelType: 'Petrol',
    },
  ];
  const creta = {
    id: '6f1c2a90-0000-4000-8000-000000000001',
    make: 'Hyundai',
    model: 'Creta',
    year: 2022,
    variant: 'SX(O) 1.5 Turbo DCT',
    fuelType: 'Petrol',
  };

  function daysFromToday(days: number): Date {
    const d = new Date();
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days),
    );
  }

  const insurance = (daysLeft: number) =>
    renderInsuranceExpiryEmail({
      appUrl: appUrl,
      user: manan,
      car: creta,
      expiryDate: daysFromToday(daysLeft),
      daysLeft,
      lastRenewal: {
        amount: 14750,
        currency: 'INR',
        date: daysFromToday(daysLeft - 365),
      },
    });

  return [
    {
      slug: 'welcome',
      label: 'Welcome',
      email: renderWelcomeEmail({ appUrl: appUrl, user: manan }),
    },
    {
      slug: 'friend-request-received',
      label: 'Friend request received',
      email: renderFriendRequestReceivedEmail({
        appUrl: appUrl,
        recipient: manan,
        sender: priya,
        senderCars: priyaCars,
      }),
    },
    {
      slug: 'friend-request-accepted',
      label: 'Friend request accepted',
      email: renderFriendRequestAcceptedEmail({
        appUrl: appUrl,
        recipient: manan,
        accepter: priya,
        accepterCars: priyaCars.slice(0, 2),
      }),
    },
    {
      slug: 'insurance-30',
      label: 'Insurance · 30 days',
      email: insurance(30),
    },
    { slug: 'insurance-7', label: 'Insurance · 7 days', email: insurance(7) },
    { slug: 'insurance-1', label: 'Insurance · 1 day', email: insurance(1) },
  ];
}
