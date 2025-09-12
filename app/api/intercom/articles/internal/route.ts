import { type NextRequest, NextResponse } from 'next/server';
import { markdownToHtml } from '@/lib/intercom/markdown-to-html';

export async function POST(request: NextRequest) {
  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;
  const workspaceId = process.env.INTERCOM_WORKSPACE_ID;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Intercom access token not configured' },
      { status: 500 },
    );
  }

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Intercom workspace ID not configured' },
      { status: 500 },
    );
  }

  try {
    const { title, content, authorId } = await request.json();

    if (!title || !content || !authorId) {
      return NextResponse.json(
        { error: 'Title, content, and authorId are required' },
        { status: 400 },
      );
    }

    // Convert markdown to HTML
    const htmlContent = await markdownToHtml(content);

    // Create internal article payload
    const articlePayload = {
      title,
      body: htmlContent,
      author_id: Number.parseInt(authorId),
      owner_id: Number.parseInt(authorId), // Same as author_id
      state: 'published',
      locale: 'en', // Required for internal articles
    };

    const response = await fetch(
      'https://api.intercom.io/internal_articles',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Intercom-Version': '2.14',
        },
        body: JSON.stringify(articlePayload),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Intercom API error:', errorData);
      return NextResponse.json(
        {
          error: `Failed to create internal article: ${response.statusText}`,
          details: errorData,
        },
        { status: response.status },
      );
    }

    const articleData = await response.json();

    return NextResponse.json({
      success: true,
      article: {
        id: articleData.id,
        title: articleData.title,
        url: `https://app.intercom.com/a/apps/${workspaceId}/articles/${articleData.id}`,
      },
    });
  } catch (error) {
    console.error('Error creating internal article:', error);
    return NextResponse.json(
      { error: 'Failed to create internal article' },
      { status: 500 },
    );
  }
}
