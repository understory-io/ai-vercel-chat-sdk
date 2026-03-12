import { createLogger } from '@/lib/logger';

const log = createLogger('slack');

export type SlackNotifyResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function notifySlackForReview({
  title,
  submittedBy,
  reviewUrl,
  reviewerSlackId,
}: {
  title: string;
  submittedBy: string;
  reviewUrl: string;
  reviewerSlackId?: string;
}): Promise<SlackNotifyResult> {
  const webhookUrl = process.env.SLACK_REVIEW_WEBHOOK_URL;
  if (!webhookUrl) {
    const reason = 'SLACK_REVIEW_WEBHOOK_URL not configured';
    log.warn(reason);
    return { ok: false, reason };
  }

  const reviewerMention = reviewerSlackId ? `<@${reviewerSlackId}> ` : '';
  const text = [
    `*New article for review*`,
    `_"${title}"_`,
    `Submitted by: ${submittedBy}`,
    reviewerMention ? `Reviewer: ${reviewerMention}` : '',
    `<${reviewUrl}|Review article →>`,
  ]
    .filter(Boolean)
    .join('\n');

  const payload = {
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text },
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      const reason = `Slack webhook returned ${res.status}: ${body}`;
      log.error({ status: res.status }, reason);
      return { ok: false, reason };
    }

    log.info({ title, submittedBy }, 'Review notification sent');
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.error({ err: error, title }, 'Failed to send review notification');
    return { ok: false, reason };
  }
}
