import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getArticleDraft, updateArticleDraft } from '@/lib/db/queries';

export async function GET(
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

  // Only owner can view drafts; pending_review and published are visible to all authenticated users
  if (
    draft.status === 'draft' &&
    draft.userId !== authResult.userId
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return Response.json(draft);
}

export async function PATCH(
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
      { error: `Cannot edit a ${draft.status} draft` },
      { status: 400 },
    );
  }

  const body = await request.json();
  const updates: Parameters<typeof updateArticleDraft>[0] = { id };

  if (body.title !== undefined) updates.title = body.title;
  if (body.content !== undefined) updates.content = body.content;
  if (body.description !== undefined) updates.description = body.description;

  const updated = await updateArticleDraft(updates);

  return Response.json(updated);
}
