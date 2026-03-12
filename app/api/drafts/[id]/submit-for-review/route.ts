import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getArticleDraft, updateArticleDraft } from '@/lib/db/queries';
import { createLogger } from '@/lib/logger';
import { notifySlackForReview } from '@/lib/slack/notify-review';

const log = createLogger('api');

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await getAuthenticatedUser();
  if (!authResult) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const draft = await getArticleDraft({ id });

  if (!draft) {
    return Response.json({ error: 'Draft not found' }, { status: 404 });
  }

  if (draft.userId !== authResult.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (draft.status !== 'draft') {
    return Response.json(
      { error: `Draft is already ${draft.status}` },
      { status: 400 },
    );
  }

  let reviewerSlackId: string | undefined;
  try {
    const body = await request.json();
    if (body.reviewerSlackId) reviewerSlackId = body.reviewerSlackId;
  } catch {
    // Empty body is fine
  }

  const now = new Date();
  await updateArticleDraft({
    id: draft.id,
    status: 'pending_review',
    submittedAt: now,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://product-documentation-generator.vercel.app';

  // Notify CS in Slack (don't fail the request if Slack is down)
  const slackResult = await notifySlackForReview({
    title: draft.title,
    submittedBy: authResult.userEmail ?? authResult.userId,
    reviewUrl: `${baseUrl}/preview/${draft.id}`,
    reviewerSlackId,
  });

  if (!slackResult.ok) {
    log.warn({ draftId: draft.id }, `Slack notification skipped: ${slackResult.reason}`);
  }

  return Response.json({
    success: true,
    status: 'pending_review',
    slackNotified: slackResult.ok,
  });
}
