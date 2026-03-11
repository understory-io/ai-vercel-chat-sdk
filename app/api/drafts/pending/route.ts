import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getArticleDraftsPendingReview } from '@/lib/db/queries';

export async function GET() {
  const authResult = await getAuthenticatedUser();
  if (!authResult) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const drafts = await getArticleDraftsPendingReview();

  return Response.json({ drafts });
}
