import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { db, getArticleDraft, updateArticleDraft } from '@/lib/db/queries';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notifyAuthorChangesRequested } from '@/lib/slack/notify-author';

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

  if (draft.status !== 'pending_review') {
    return Response.json(
      { error: `Draft is not pending review (status: ${draft.status})` },
      { status: 400 },
    );
  }

  let note: string | undefined;
  try {
    const body = await request.json();
    if (body.note) note = body.note;
  } catch {
    // Empty body is fine
  }

  await updateArticleDraft({
    id: draft.id,
    status: 'draft',
    reviewedBy: authResult.userId,
    reviewedAt: new Date(),
    reviewResult: 'changes_requested',
    submittedAt: null,
  });

  // Look up author email and reviewer name, then notify via Slack DM
  const [author] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, draft.userId));

  if (author?.email) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://product-documentation-generator.vercel.app';

    try {
      await notifyAuthorChangesRequested({
        authorEmail: author.email,
        articleTitle: draft.title,
        reviewUrl: `${baseUrl}/preview/${draft.id}`,
        note,
        reviewerName: authResult.userEmail ?? undefined,
      });
    } catch (err) {
      console.error('Failed to notify author via Slack:', err);
    }
  } else {
    console.warn(`No email found for author userId=${draft.userId}`);
  }

  return Response.json({ success: true, status: 'draft' });
}
