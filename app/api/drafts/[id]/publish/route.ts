import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getArticleDraft, updateArticleDraft } from '@/lib/db/queries';
import { markdownToHtml } from '@/lib/intercom/markdown-to-html';

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

  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;
  const workspaceId = process.env.INTERCOM_WORKSPACE_ID;

  if (!accessToken || !workspaceId) {
    return Response.json(
      { error: 'Intercom not configured' },
      { status: 500 },
    );
  }

  // Parse optional body params for collection and author selection
  let collectionId: string | undefined;
  let authorId: number | undefined;
  let description: string | undefined;

  try {
    const body = await request.json();
    collectionId = body.collectionId;
    if (body.authorId) authorId = Number.parseInt(body.authorId);
    if (body.description !== undefined) description = body.description;
  } catch {
    // Empty body is fine — we'll fall back to defaults
  }

  // Use description from body, or fall back to draft description
  const finalDescription = (description ?? draft.description)?.slice(0, 255);

  // If no author provided, fetch first available admin as fallback
  if (!authorId) {
    const adminsRes = await fetch('https://api.intercom.io/admins', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Intercom-Version': '2.14',
      },
    });

    if (adminsRes.ok) {
      const adminsData = await adminsRes.json();
      const admins = adminsData.admins || [];
      if (admins.length > 0) {
        authorId = admins[0].id;
      }
    }

    if (!authorId) {
      return Response.json(
        { error: 'No Intercom admin found to set as author' },
        { status: 500 },
      );
    }
  }

  // Convert markdown to HTML for Intercom
  const htmlContent = await markdownToHtml(draft.content);

  // Build article payload — always creates as draft in Intercom for CS review
  const articlePayload: Record<string, unknown> = {
    title: draft.title,
    body: htmlContent,
    author_id: authorId,
    state: 'draft',
  };

  // Place in a collection if specified (help center article)
  if (collectionId) {
    articlePayload.parent_type = 'collection';
    articlePayload.parent_id = Number.parseInt(collectionId);
  }

  if (finalDescription) {
    articlePayload.description = finalDescription;
  }

  const response = await fetch('https://api.intercom.io/articles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Intercom-Version': '2.14',
    },
    body: JSON.stringify(articlePayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Intercom publish error:', errorData);
    return Response.json(
      { error: 'Failed to publish to Intercom', details: errorData },
      { status: response.status },
    );
  }

  const articleData = await response.json();

  // Update draft status
  await updateArticleDraft({
    id: draft.id,
    status: 'published',
    intercomArticleId: String(articleData.id),
  });

  return Response.json({
    success: true,
    intercomArticleId: articleData.id,
    intercomUrl: `https://app.intercom.com/a/apps/${workspaceId}/articles/${articleData.id}`,
  });
}
