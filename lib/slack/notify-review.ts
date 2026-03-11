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
}) {
  const webhookUrl = process.env.SLACK_REVIEW_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(
      'SLACK_REVIEW_WEBHOOK_URL not configured, skipping notification',
    );
    return;
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
      console.error('Slack notification failed:', res.status, await res.text());
    }
  } catch (error) {
    console.error('Slack notification error:', error);
  }
}
