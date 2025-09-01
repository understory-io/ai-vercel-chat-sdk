import { type NextRequest, NextResponse } from 'next/server';
import { notionService } from '@/lib/notion/client';

interface ContentRequest {
  pageIds: string[];
}

interface ContentResult {
  id: string;
  content?: string;
  status: 'success' | 'error';
  error?: string;
}

interface ContentResponse {
  success: boolean;
  results: ContentResult[];
  timestamp: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: ContentRequest = await request.json();
    const { pageIds } = body;

    if (!Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'pageIds array is required',
          timestamp: Date.now()
        },
        { status: 400 }
      );
    }

    // Limit batch size to prevent timeouts
    if (pageIds.length > 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'Maximum 10 pages allowed per batch',
          timestamp: Date.now()
        },
        { status: 400 }
      );
    }

    // Fetch content for each page
    const results: ContentResult[] = await Promise.allSettled(
      pageIds.map(async (pageId): Promise<ContentResult> => {
        try {
          const content = await notionService.getPageContent(pageId);
          return {
            id: pageId,
            content,
            status: 'success'
          };
        } catch (error) {
          console.error(`Failed to fetch content for page ${pageId}:`, error);
          return {
            id: pageId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    ).then(results => 
      results.map(result => 
        result.status === 'fulfilled' ? result.value : {
          id: 'unknown',
          status: 'error' as const,
          error: 'Promise rejected'
        }
      )
    );

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      results,
      timestamp: Date.now(),
      meta: {
        total: pageIds.length,
        successful: successCount,
        failed: errorCount
      }
    });

  } catch (error) {
    console.error('Content API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch content',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}