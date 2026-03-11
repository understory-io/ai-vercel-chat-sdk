import { getAuthenticatedUser } from '@/lib/auth-helpers';
import {
  db,
  getArticleDraft,
  updateArticleDraft,
} from '@/lib/db/queries';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
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

  if (draft.status !== 'pending_review') {
    return Response.json(
      { error: `Draft is not pending review (status: ${draft.status})` },
      { status: 400 },
    );
  }

  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;
  const workspaceId = process.env.INTERCOM_WORKSPACE_ID;

  if (!accessToken || !workspaceId) {
    return Response.json({ error: 'Intercom not configured' }, { status: 500 });
  }

  let collectionId: string | undefined;
  let authorId: number | undefined;
  let description: string | undefined;

  try {
    const body = await request.json();
    collectionId = body.collectionId;
    if (body.authorId) authorId = Number.parseInt(body.authorId);
    if (body.description !== undefined) description = body.description;
  } catch {
    // Empty body is fine
  }

  const finalDescription = (description ?? draft.description)?.slice(0, 255);

  // If no author provided, try to match by email
  if (!authorId) {
    const [dbUser] = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, draft.userId));
    const userEmail = dbUser?.email;

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
      const matched = userEmail
        ? admins.find(
            (a: { email: string }) =>
              a.email?.toLowerCase() === userEmail.toLowerCase(),
          )
        : null;
      authorId = matched?.id || admins[0]?.id;
    }

    if (!authorId) {
      return Response.json(
        { error: 'No Intercom admin found to set as author' },
        { status: 500 },
      );
    }
  }

  const htmlContent = await markdownToHtml(draft.content);

  const articlePayload: Record<string, unknown> = {
    title: draft.title,
    body: htmlContent,
    author_id: authorId,
    state: 'draft',
  };

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

  const appSlug =
    articleData.workspace_id || process.env.INTERCOM_APP_ID || workspaceId;
  const intercomUrl =
    articleData.url ||
    `https://app.intercom.com/a/apps/${appSlug}/knowledge-hub/all-content?searchTerm=${encodeURIComponent(draft.title)}`;

  await updateArticleDraft({
    id: draft.id,
    status: 'published',
    intercomArticleId: String(articleData.id),
    reviewedBy: authResult.userId,
    reviewedAt: new Date(),
  });

  return Response.json({
    success: true,
    intercomArticleId: articleData.id,
    intercomUrl,
  });
}
