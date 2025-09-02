import { type NextRequest, NextResponse } from 'next/server';
import { notionExporter } from '@/lib/notion/export';
import { auth } from '@/app/(auth)/auth';

interface ExportRequest {
  title: string;
  content: string;
  parentPageId?: string;
  databaseId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ExportRequest = await request.json();
    let { title, content, parentPageId, databaseId } = body;

    if (!title || !content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Title and content are required',
        },
        { status: 400 }
      );
    }

    // Default to dedicated storing database if not provided
    if (!databaseId) {
      const envDb = process.env.NOTION_STORING_DATABASE_ID;
      console.log('Environment NOTION_STORING_DATABASE_ID:', envDb);
      if (envDb?.trim()) {
        databaseId = envDb.trim();
        console.log('Using database ID from environment:', databaseId);
      } else {
        console.log('No NOTION_STORING_DATABASE_ID found in environment');
      }
    }

    // Export to Notion
    const result = await notionExporter.exportToNotion({
      title,
      content,
      parentPageId,
      databaseId,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        pageId: result.pageId,
        url: result.url,
        message: 'Successfully exported to Notion',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to export to Notion',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Notion export API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Test connection
    const isConnected = await notionExporter.testExportConnection();
    
    return NextResponse.json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'Notion connection is working' : 'Notion connection failed',
    });
  } catch (error) {
    console.error('Notion connection test error:', error);
    
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      },
      { status: 500 }
    );
  }
}
