import { getSlackMembers } from './members';

/**
 * Send a Slack DM to the article author when changes are requested.
 * Looks up the author's Slack user ID by email, opens a DM channel, and posts a message.
 */
export async function notifyAuthorChangesRequested({
  authorEmail,
  articleTitle,
  reviewUrl,
  note,
  reviewerName,
}: {
  authorEmail: string;
  articleTitle: string;
  reviewUrl: string;
  note?: string;
  reviewerName?: string;
}) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn('SLACK_BOT_TOKEN not configured, skipping author notification');
    return;
  }

  // Find Slack user by email
  const members = await getSlackMembers();
  const slackUser = members.find(
    (m) => m.email?.toLowerCase() === authorEmail.toLowerCase(),
  );

  if (!slackUser) {
    console.warn(
      `No Slack user found for email ${authorEmail}, skipping notification`,
    );
    return;
  }

  // Open a DM channel
  const openRes = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ users: slackUser.id }),
  });

  const openData = await openRes.json();
  if (!openData.ok) {
    console.error('Failed to open Slack DM:', openData.error);
    return;
  }

  const channelId = openData.channel.id;

  // Build message
  const reviewer = reviewerName ? ` by ${reviewerName}` : '';
  const lines = [
    `*Changes requested${reviewer}*`,
    `_"${articleTitle}"_`,
    note ? `\n> ${note}` : '',
    `\n<${reviewUrl}|View article →>`,
  ]
    .filter(Boolean)
    .join('\n');

  // Send DM
  const msgRes = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: channelId,
      text: lines,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: lines },
        },
      ],
    }),
  });

  const msgData = await msgRes.json();
  if (!msgData.ok) {
    console.error('Failed to send Slack DM:', msgData.error);
  }
}
