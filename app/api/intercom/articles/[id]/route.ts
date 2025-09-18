import { type NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;
  const { id: articleId } = await params;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Intercom access token not configured' },
      { status: 500 }
    );
  }

  if (!articleId) {
    return NextResponse.json(
      { error: 'Article ID is required' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`https://api.intercom.io/articles/${articleId}`, {
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
        { error: `Failed to fetch article: ${response.statusText}` },
        { status: response.status }
      );
    }

    const article = await response.json();

    // Return the full article data including body content
    return NextResponse.json({
      id: article.id,
      title: article.title,
      description: article.description,
      body: article.body, // This contains the full HTML content
      state: article.state,
      author_id: article.author_id,
      created_at: article.created_at,
      updated_at: article.updated_at,
      parent_id: article.parent_id,
      parent_type: article.parent_type,
      url: article.url,
    });

  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}