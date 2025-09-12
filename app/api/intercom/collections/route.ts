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
    const response = await fetch('https://api.intercom.io/help_center/collections', {
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
    
    // Transform collections into a tree structure for easier navigation
    const collections = data.data || [];
    
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