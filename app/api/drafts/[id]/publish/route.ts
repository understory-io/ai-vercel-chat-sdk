/**
 * @deprecated Use POST /api/drafts/[id]/submit-for-review → /api/drafts/[id]/approve instead.
 */
export async function POST() {
  return Response.json(
    {
      error:
        'This endpoint is deprecated. Use /api/drafts/{id}/submit-for-review to submit for CS review, then /api/drafts/{id}/approve to publish.',
    },
    { status: 410 },
  );
}
