interface SlackMember {
  id: string;
  name: string;
  realName: string;
  email?: string;
}

/**
 * Fetches real (non-bot, non-deleted) members from the Slack workspace.
 * Requires SLACK_BOT_TOKEN with users:read and users:read.email scopes.
 */
export async function getSlackMembers(): Promise<SlackMember[]> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN not configured');
  }

  const members: SlackMember[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ limit: '200' });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(
      `https://slack.com/api/users.list?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      throw new Error(`Slack API error: ${res.status}`);
    }

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    for (const member of data.members || []) {
      if (member.deleted || member.is_bot || member.id === 'USLACKBOT') {
        continue;
      }

      members.push({
        id: member.id,
        name: member.name,
        realName: member.real_name || member.name,
        email: member.profile?.email,
      });
    }

    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return members.sort((a, b) => a.realName.localeCompare(b.realName));
}
