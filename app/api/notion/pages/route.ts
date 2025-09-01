import { type NextRequest, NextResponse } from 'next/server';
import { notionService, type NotionPage } from '@/lib/notion/client';

interface CachedResult {
  pages: NotionPage[];
  timestamp: number;
  query?: string;
}

// In-memory cache (5 minutes TTL)
const cache = new Map<string, CachedResult>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

function getCacheKey(query?: string): string {
  return query ? `search:${query}` : 'recent';
}

function isCacheValid(cached: CachedResult): boolean {
  return Date.now() - cached.timestamp < CACHE_TTL;
}

function cleanCache(): void {
  if (cache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    for (let i = 0; i < entries.length - MAX_CACHE_SIZE + 10; i++) {
      cache.delete(entries[i][0]);
    }
  }
}

function filterCachedPages(pages: NotionPage[], query: string): NotionPage[] {
  const lowercaseQuery = query.toLowerCase();
  return pages.filter(page => 
    page.title.toLowerCase().includes(lowercaseQuery) ||
    page.path.toLowerCase().includes(lowercaseQuery)
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const allPagesKey = 'all_pages';
    const searchCacheKey = query.trim() ? `search:${query.trim()}` : allPagesKey;

    // Always try to get ALL pages first (cached)
    const allPagesCached = cache.get(allPagesKey);
    
    if (query.trim()) {
      // SEARCH MODE: Filter through all pages
      
      // Check if we have a cached search result
      const searchCached = cache.get(searchCacheKey);
      if (searchCached && isCacheValid(searchCached)) {
        return NextResponse.json({
          success: true,
          pages: searchCached.pages,
          source: 'search_cache',
          timestamp: searchCached.timestamp,
          total: searchCached.pages.length,
          totalInDatabase: allPagesCached?.pages.length || 0
        });
      }
      
      // Use cached all pages if available, otherwise fetch
      let allPages: NotionPage[];
      if (allPagesCached && isCacheValid(allPagesCached)) {
        allPages = allPagesCached.pages;
      } else {
        allPages = await notionService.getAllPages();
        // Cache all pages
        cache.set(allPagesKey, {
          pages: allPages,
          timestamp: Date.now()
        });
      }
      
      // Filter pages by search query
      const filteredPages = filterCachedPages(allPages, query);
      
      // Cache the search results
      cache.set(searchCacheKey, {
        pages: filteredPages,
        timestamp: Date.now(),
        query
      });
      
      return NextResponse.json({
        success: true,
        pages: filteredPages,
        source: 'search_filtered',
        timestamp: Date.now(),
        total: filteredPages.length,
        totalInDatabase: allPages.length
      });
      
    } else {
      // NO SEARCH: Return all pages
      
      // Check cache for all pages
      if (allPagesCached && isCacheValid(allPagesCached)) {
        return NextResponse.json({
          success: true,
          pages: allPagesCached.pages,
          source: 'cache',
          timestamp: allPagesCached.timestamp,
          total: allPagesCached.pages.length,
          totalInDatabase: allPagesCached.pages.length
        });
      }
      
      // Fetch all pages from Notion
      const pages = await notionService.getAllPages();
      
      // Cache all pages
      cache.set(allPagesKey, {
        pages,
        timestamp: Date.now()
      });
      
      // Clean cache if needed
      cleanCache();
      
      return NextResponse.json({
        success: true,
        pages,
        source: 'api_all',
        timestamp: Date.now(),
        total: pages.length,
        totalInDatabase: pages.length
      });
    }

  } catch (error) {
    console.error('Notion API error:', error);
    
    // Determine error type for better user experience
    let errorMessage = 'Failed to fetch Notion pages';
    let errorCode = 'UNKNOWN_ERROR';

    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('unauthorized')) {
        errorMessage = 'Invalid Notion token. Please check your integration setup.';
        errorCode = 'UNAUTHORIZED';
      } else if (error.message.includes('rate_limited')) {
        errorMessage = 'Rate limited by Notion API. Please try again in a moment.';
        errorCode = 'RATE_LIMITED';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
        errorCode = 'NETWORK_ERROR';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: errorCode,
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}

// Test endpoint to verify connection
export async function POST(request: NextRequest) {
  try {
    const isConnected = await notionService.testConnection();
    
    return NextResponse.json({
      success: true,
      connected: isConnected,
      timestamp: Date.now()
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}