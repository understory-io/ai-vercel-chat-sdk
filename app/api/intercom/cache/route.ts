import { type NextRequest, NextResponse } from 'next/server';
import { deleteCached } from '@/lib/redis';

export async function DELETE(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get('action');

    if (action === 'articles') {
      // Clear the articles cache
      await deleteCached('intercom:articles:all');
      console.log('Cleared Intercom articles cache');

      return NextResponse.json({
        success: true,
        message: 'Articles cache cleared successfully'
      });
    }

    if (action === 'all') {
      // Clear all intercom-related caches
      await deleteCached('intercom:articles:all');
      console.log('Cleared all Intercom caches');

      return NextResponse.json({
        success: true,
        message: 'All Intercom caches cleared successfully'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use ?action=articles or ?action=all' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Intercom Cache Management',
    endpoints: {
      'DELETE /api/intercom/cache?action=articles': 'Clear articles cache',
      'DELETE /api/intercom/cache?action=all': 'Clear all Intercom caches'
    },
    cache_ttl: '5 minutes (300 seconds)'
  });
}