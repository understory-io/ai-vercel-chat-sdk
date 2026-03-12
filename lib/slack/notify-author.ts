import { createLogger } from '@/lib/logger';

const log = createLogger('slack');

export type SlackAuthorNotifyResult =
  | { ok: true }
  | { ok: false; reason: string };

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
}): Promise<SlackAuthorNotifyResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    const reason = 'SLACK_BOT_TOKEN not configured';
    log.warn(reason);
    return { ok: false, reason };
  }

  // Look up Slack user by email (requires users:read.email scope)
  const lookupRes = await fetch(
    `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(authorEmail)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const lookupData = await lookupRes.json();

  if (!lookupData.ok) {
    const reason = `Slack lookupByEmail failed for ${authorEmail}: ${lookupData.error}`;
    log.warn({ authorEmail }, reason);
    return { ok: false, reason };
  }

  const slackUserId = lookupData.user.id;

  // Open a DM channel
  const openRes = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ users: slackUserId }),
  });

  const openData = await openRes.json();
  if (!openData.ok) {
    const reason = `Failed to open Slack DM: ${openData.error}`;
    log.error({ slackUserId }, reason);
    return { ok: false, reason };
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
    const reason = `Failed to send Slack DM: ${msgData.error}`;
    log.error({ channelId }, reason);
    return { ok: false, reason };
  }

  log.info({ authorEmail, articleTitle }, 'Author notified of changes requested');
  return { ok: true };
}
