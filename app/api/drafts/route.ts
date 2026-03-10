import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { createArticleDraft, getArticleDraftsByUserId } from '@/lib/db/queries';

export async function GET() {
  const authResult = await getAuthenticatedUser();
  if (!authResult) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const drafts = await getArticleDraftsByUserId({
    userId: authResult.userId,
  });

  return Response.json({ drafts });
}

export async function POST(request: Request) {
  const authResult = await getAuthenticatedUser();
  if (!authResult) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, content, description } = body;

  if (!title?.trim() || !content?.trim()) {
    return Response.json(
      { error: 'Title and content are required' },
      { status: 400 },
    );
  }

  const draft = await createArticleDraft({
    userId: authResult.userId,
    title: title.trim(),
    content: content.trim(),
    description: description?.trim()?.slice(0, 255),
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

  return Response.json({
    id: draft.id,
    previewUrl: `${baseUrl}/preview/${draft.id}?watch=true`,
    createdAt: draft.createdAt,
  });
}
