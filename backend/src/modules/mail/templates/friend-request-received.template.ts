import {
  GarageCar,
  PersonSummary,
  RenderedEmail,
  button,
  esc,
  firstNameOf,
  garageText,
  nameOf,
  note,
  personCard,
  renderLayout,
  textFooter,
} from './layout';

export interface FriendRequestReceivedEmailData {
  appUrl: string;
  recipient: PersonSummary;
  sender: PersonSummary;
  // Public specs only: the same fields a friend's public garage shows.
  senderCars: GarageCar[];
}

export function renderFriendRequestReceivedEmail(
  data: FriendRequestReceivedEmailData,
): RenderedEmail {
  const appUrl = data.appUrl.replace(/\/+$/, '');
  const senderName = nameOf(data.sender);
  const reviewUrl = `${appUrl}/dashboard/friends`;

  const body = [
    personCard(data.sender, data.senderCars),
    button('Review request', reviewUrl),
    note(
      `Friends see each other's cars, never expenses, VIN or odometer. Don't know them? Decline it, they won't be told.`,
    ),
  ].join('\n');

  const html = renderLayout({
    appUrl,
    preheader: `@${data.sender.username} sent you a friend request on Glovebox.`,
    eyebrow: 'Friend request',
    headline: `${firstNameOf(data.sender)} wants to`,
    headlineAccent: 'see your garage.',
    body,
    footerNote: `Sent to @${esc(data.recipient.username)} because of a new friend request.`,
  });

  const cars = data.senderCars.length
    ? `\nTheir garage:\n${garageText(data.senderCars)}\n`
    : '';

  const text = `Hey ${firstNameOf(data.recipient)},

${senderName} (@${data.sender.username}) sent you a friend request on Glovebox.
${cars}
Review request: ${reviewUrl}

Friends see each other's cars, never expenses, VIN or odometer. Don't know them? Decline it, they won't be told.

${textFooter(appUrl)}`;

  return {
    subject: `${senderName} wants to see your garage`,
    html,
    text,
  };
}
