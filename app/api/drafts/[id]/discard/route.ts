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

  if (draft.userId !== authResult.userId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (draft.status !== 'draft') {
    return Response.json(
      { error: `Draft is already ${draft.status}` },
      { status: 400 },
    );
  }

  await updateArticleDraft({ id: draft.id, status: 'discarded' });

  return Response.json({ success: true });
}
