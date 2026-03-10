import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getArticleDraft, updateArticleDraft } from '@/lib/db/queries';
import { markdownToHtml } from '@/lib/intercom/markdown-to-html';

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

  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;
  const workspaceId = process.env.INTERCOM_WORKSPACE_ID;

  if (!accessToken || !workspaceId) {
    return Response.json(
      { error: 'Intercom not configured' },
      { status: 500 },
    );
  }

  // Convert markdown to HTML for Intercom
  const htmlContent = await markdownToHtml(draft.content);

  // Fetch admins to use first available as author
  const adminsRes = await fetch('https://api.intercom.io/admins', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Intercom-Version': '2.14',
    },
  });

  let authorId: number | undefined;
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

  // Create as draft in Intercom (not published — CS can review there too)
  const articlePayload: Record<string, unknown> = {
    title: draft.title,
    body: htmlContent,
    author_id: authorId,
    state: 'draft',
  };

  if (draft.description) {
    articlePayload.description = draft.description.slice(0, 255);
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
