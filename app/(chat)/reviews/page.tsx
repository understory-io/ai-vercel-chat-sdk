import { auth } from '@/app/(auth)/auth';
import { redirect } from 'next/navigation';
import { getArticleDraftsForReviewDashboard } from '@/lib/db/queries';
import { ReviewDashboard } from '@/components/review-dashboard';

export default async function ReviewsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const drafts = await getArticleDraftsForReviewDashboard();

  return <ReviewDashboard drafts={drafts} />;
}
