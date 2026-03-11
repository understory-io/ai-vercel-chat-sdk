import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getArticleDraft, updateArticleDraft } from '@/lib/db/queries';

export async function POST(
  _request: Request,
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

  await updateArticleDraft({
    id: draft.id,
    status: 'draft',
    reviewedBy: authResult.userId,
    reviewedAt: new Date(),
    submittedAt: null,
  });

  return Response.json({ success: true, status: 'draft' });
}
