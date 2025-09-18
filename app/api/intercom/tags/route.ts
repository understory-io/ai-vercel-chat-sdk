import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Intercom access token not configured' },
      { status: 500 },
    );
  }

  try {
    const { baseTagName } = await request.json();

    if (!baseTagName) {
      return NextResponse.json(
        { error: 'Base tag name is required' },
        { status: 400 },
      );
    }

    // Clean the base tag name - keep it readable but safe
    const cleanTagBase = baseTagName.replace(/[^\w\s-]/g, '').trim();
    if (!cleanTagBase) {
      return NextResponse.json(
        { error: 'Invalid tag name after cleaning' },
        { status: 400 },
      );
    }

    // Get existing tags to check for conflicts
    const getTagsResponse = await fetch('https://api.intercom.io/tags', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Intercom-Version': '2.14',
      },
    });

    if (!getTagsResponse.ok) {
      console.error('Failed to fetch existing tags:', getTagsResponse.statusText);
      return NextResponse.json(
        { error: 'Failed to check existing tags' },
        { status: getTagsResponse.status },
      );
    }

    const existingTagsData = await getTagsResponse.json();
    const existingTagNames = (existingTagsData.data || []).map((tag: any) => tag.name);

    // Generate unique tag name
    let finalTagName = `doc_pair:${cleanTagBase}`;
    let counter = 1;

    while (existingTagNames.includes(finalTagName)) {
      finalTagName = `doc_pair:${cleanTagBase}${counter}`;
      counter++;
    }

    // Create the new tag
    const createTagResponse = await fetch('https://api.intercom.io/tags', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Intercom-Version': '2.14',
      },
      body: JSON.stringify({
        name: finalTagName,
      }),
    });

    if (!createTagResponse.ok) {
      const errorData = await createTagResponse.json().catch(() => ({}));
      console.error('Intercom tag creation error:', errorData);
      return NextResponse.json(
        {
          error: `Failed to create tag: ${createTagResponse.statusText}`,
          details: errorData,
        },
        { status: createTagResponse.status },
      );
    }

    const tagData = await createTagResponse.json();

    return NextResponse.json({
      success: true,
      tag: {
        id: tagData.id,
        name: tagData.name,
      },
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 },
    );
  }
}