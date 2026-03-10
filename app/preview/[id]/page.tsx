import { getArticleDraft } from '@/lib/db/queries';
import { notFound } from 'next/navigation';
import { PreviewClient } from '@/components/preview-client';

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draft = await getArticleDraft({ id });

  if (!draft || draft.status === 'discarded') {
    notFound();
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
      }}
    />
  );
}
