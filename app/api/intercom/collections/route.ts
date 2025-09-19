import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Intercom access token not configured' },
      { status: 500 }
    );
  }

  try {
    const allCollections: any[] = [];
    let nextUrl: string | null = 'https://api.intercom.io/help_center/collections';
    let pageCount = 0;

    // Fetch all pages of collections
    while (nextUrl && pageCount < 10) { // Safety limit of 10 pages
      pageCount++;
      console.log(`Fetching collections page ${pageCount}: ${nextUrl}`);

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
          { error: `Failed to fetch collections: ${response.statusText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      const pageCollections = data.data || [];
      allCollections.push(...pageCollections);

      // Check for next page
      nextUrl = data.pages?.next || null;
      console.log(`Fetched ${pageCollections.length} collections from page ${pageCount}, total so far: ${allCollections.length}`);
    }

    console.log(`Total collections fetched: ${allCollections.length}`);

    // Transform collections into a tree structure for easier navigation
    const collections = allCollections;
    
    // Group collections by parent_id for tree building
    const collectionMap = new Map();
    const rootCollections: any[] = [];
    
    // First pass: create map of all collections
    collections.forEach((collection: any) => {
      collectionMap.set(collection.id, {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        parent_id: collection.parent_id,
        children: []
      });
    });
    
    // Second pass: build tree structure
    collections.forEach((collection: any) => {
      const collectionData = collectionMap.get(collection.id);
      
      if (collection.parent_id) {
        // Has parent, add to parent's children
        const parent = collectionMap.get(collection.parent_id);
        if (parent) {
          parent.children.push(collectionData);
        }
      } else {
        // Root level collection
        rootCollections.push(collectionData);
      }
    });

    return NextResponse.json({
      collections: rootCollections,
      flat_collections: Array.from(collectionMap.values()) // Also provide flat structure
    });

  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}