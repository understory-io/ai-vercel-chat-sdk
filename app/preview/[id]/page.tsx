import { getArticleDraft } from '@/lib/db/queries';
import { notFound } from 'next/navigation';
import { PreviewClient } from '@/components/preview-client';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db/queries';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [draft, session] = await Promise.all([getArticleDraft({ id }), auth()]);

  if (!draft) {
    notFound();
  }

  // Look up author info
  let authorName: string | null = null;
  let authorEmail: string | null = null;
  const [author] = await db
    .select({ name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, draft.userId));
  if (author) {
    authorName = author.name;
    authorEmail = author.email;
  }

  return (
    <PreviewClient
      initialDraft={{
        id: draft.id,
        title: draft.title,
        content: draft.content,
        description: draft.description,
        status: draft.status,
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
        intercomArticleId: draft.intercomArticleId,
        userId: draft.userId,
        submittedAt: draft.submittedAt?.toISOString() ?? null,
      }}
      currentUserId={session?.user?.id ?? null}
      authorName={authorName}
      authorEmail={authorEmail}
    />
  );
}
