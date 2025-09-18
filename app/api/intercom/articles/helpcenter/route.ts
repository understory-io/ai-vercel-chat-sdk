import { type NextRequest, NextResponse } from 'next/server';
import { markdownToHtml } from '@/lib/intercom/markdown-to-html';
import { getCached, setCached } from '@/lib/redis';

export async function GET(request: NextRequest) {
  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;
  const collectionId = request.nextUrl.searchParams.get('collection_id');
  const metadataOnly = request.nextUrl.searchParams.get('metadata_only') === 'true';

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Intercom access token not configured' },
      { status: 500 }
    );
  }

  try {
    // Check cache first (5 minute TTL)
    const cacheKey = 'intercom:articles:all';
    let data = await getCached(cacheKey);

    if (!data) {
      // Fetch all pages from Intercom API
      const allArticles = [];
      let nextUrl: string | null = 'https://api.intercom.io/articles';
      let pageCount = 0;

      while (nextUrl && pageCount < 10) { // Safety limit of 10 pages
        pageCount++;

        const response: Response = await fetch(nextUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'Intercom-Version': '2.14',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Intercom API error:', errorData);
          return NextResponse.json(
            { error: `Failed to fetch articles: ${response.statusText}` },
            { status: response.status }
          );
        }

        const pageData = await response.json();
        allArticles.push(...(pageData.data || []));

        // Check for next page
        nextUrl = pageData.pages?.next || null;
      }

      // Create consolidated response
      data = {
        type: 'article.list',
        data: allArticles,
        total_count: allArticles.length,
        pages: {
          type: 'pages',
          page: 1,
          per_page: allArticles.length,
          total_pages: 1
        }
      };

      // Cache the full response for 5 minutes (300 seconds)
      await setCached(cacheKey, data, 300);
    }

    // Transform articles data - exclude body if metadata_only is true
    let articles = (data.data || []).map((article: any) => {
      const baseFields = {
        id: article.id,
        title: article.title,
        description: article.description,
        state: article.state,
        author_id: article.author_id,
        created_at: article.created_at,
        updated_at: article.updated_at,
        parent_id: article.parent_id,
        parent_ids: article.parent_ids,  // Add parent_ids array field
        parent_type: article.parent_type,
      };

      // Include body only if not metadata_only
      if (!metadataOnly) {
        return {
          ...baseFields,
          body: article.body,
        };
      }

      return baseFields;
    });

    // Filter by collection_id if provided
    if (collectionId) {
      articles = articles.filter((article: any) =>
        article.parent_id === collectionId && article.parent_type === 'collection'
      );
    }

    return NextResponse.json({
      articles,
      total: articles.length,
      metadata_only: metadataOnly,
    });

  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;
  const workspaceId = process.env.INTERCOM_WORKSPACE_ID;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Intercom access token not configured' },
      { status: 500 }
    );
  }

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Intercom workspace ID not configured' },
      { status: 500 }
    );
  }

  try {
    const { title, content, authorId, collectionId, description } = await request.json();

    if (!title || !content || !authorId) {
      return NextResponse.json(
        { error: 'Title, content, and authorId are required' },
        { status: 400 }
      );
    }

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required for help center articles' },
        { status: 400 }
      );
    }

    // Convert markdown to HTML
    const htmlContent = await markdownToHtml(content);

    // Create help center article payload
    const articlePayload = {
      title,
      body: htmlContent,
      author_id: Number.parseInt(authorId),
      parent_type: 'collection',
      parent_id: Number.parseInt(collectionId),
      state: 'draft', // Create as draft for review
      ...(description && { description: description.slice(0, 100) }) // Ensure max 100 chars
    };

    const response = await fetch('https://api.intercom.io/articles', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Intercom-Version': '2.14',
      },
      body: JSON.stringify(articlePayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Intercom API error:', errorData);
      return NextResponse.json(
        { error: `Failed to create help center article: ${response.statusText}`, details: errorData },
        { status: response.status }
      );
    }

    const articleData = await response.json();

    return NextResponse.json({
      success: true,
      article: {
        id: articleData.id,
        title: articleData.title,
        url: `https://app.intercom.com/a/apps/${workspaceId}/articles/${articleData.id}`,
      }
    });

  } catch (error) {
    console.error('Error creating help center article:', error);
    return NextResponse.json(
      { error: 'Failed to create help center article' },
      { status: 500 }
    );
  }
}