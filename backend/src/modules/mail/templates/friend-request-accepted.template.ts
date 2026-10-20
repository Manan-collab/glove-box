import {
  GarageCar,
  PersonSummary,
  RenderedEmail,
  button,
  esc,
  firstNameOf,
  garageText,
  nameOf,
  personCard,
  renderLayout,
  textFooter,
} from './layout';

export interface FriendRequestAcceptedEmailData {
  appUrl: string;
  // The person who sent the original request and is now being told.
  recipient: PersonSummary;
  accepter: PersonSummary;
  accepterCars: GarageCar[];
}

export function renderFriendRequestAcceptedEmail(
  data: FriendRequestAcceptedEmailData,
): RenderedEmail {
  const appUrl = data.appUrl.replace(/\/+$/, '');
  const accepterName = nameOf(data.accepter);
  const accepterFirst = firstNameOf(data.accepter);
  const garageUrl = `${appUrl}/dashboard/friends/${encodeURIComponent(data.accepter.username)}`;

  const body = [
    personCard(data.accepter, data.accepterCars),
    button(`Visit ${accepterFirst}'s garage`, garageUrl),
  ].join('\n');

  const html = renderLayout({
    appUrl,
    preheader: `${accepterName} accepted your friend request. Their garage is open to you.`,
    eyebrow: 'Request accepted',
    headline: `You and ${accepterFirst} are`,
    headlineAccent: 'now friends.',
    body,
    footerNote: `Sent to @${esc(data.recipient.username)} because a friend request was accepted.`,
  });

  const cars = data.accepterCars.length
    ? `\nTheir garage:\n${garageText(data.accepterCars)}\n`
    : '';

  const text = `Hey ${firstNameOf(data.recipient)},

${accepterName} (@${data.accepter.username}) accepted your friend request. You're now friends on Glovebox.
${cars}
Visit ${accepterFirst}'s garage: ${garageUrl}

${textFooter(appUrl)}`;

  return {
    subject: `${accepterName} accepted your friend request`,
    html,
    text,
  };
}
