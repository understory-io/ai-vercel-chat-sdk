import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getSlackMembers } from '@/lib/slack/members';

export async function GET() {
  const authResult = await getAuthenticatedUser();
  if (!authResult) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const members = await getSlackMembers();
    return Response.json({ members });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch Slack members';
    return Response.json({ error: message }, { status: 500 });
  }
}
