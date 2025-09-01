import { markdownToBlocks } from '@tryfabric/martian';
import { Client } from '@notionhq/client';

export interface NotionExportOptions {
  title: string;
  content: string;
  parentPageId?: string;
  databaseId?: string;
}

export interface NotionExportResult {
  success: boolean;
  pageId?: string;
  url?: string;
  error?: string;
}

export class NotionExporter {
  private client: Client;

  constructor() {
    const token = process.env.NOTION_TOKEN;
    
    if (!token) {
      throw new Error('NOTION_TOKEN environment variable is required');
    }
    
    this.client = new Client({
      auth: token,
    });
  }

  /**
   * Export content to Notion as a new page
   */
  async exportToNotion({
    title,
    content,
    parentPageId,
    databaseId,
  }: NotionExportOptions): Promise<NotionExportResult> {
    try {
      // Convert markdown content to Notion blocks using martian
      const blocks = markdownToBlocks(content);
      
      // Prepare page properties
      const pageProps: any = {
        parent: databaseId 
          ? { database_id: databaseId }
          : parentPageId 
          ? { page_id: parentPageId }
          : { type: 'workspace' },
        properties: {},
        children: blocks,
      };

      // If creating in database, add title as property
      if (databaseId) {
        pageProps.properties = {
          Name: {
            title: [
              {
                text: {
                  content: title,
                },
              },
            ],
          },
        };
      } else {
        // If creating as standalone page, add title
        pageProps.properties = {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        };
      }

      // Create the page
      const response = await this.client.pages.create(pageProps);
      
      // Get the page URL
      const pageUrl = `https://notion.so/${response.id.replace(/-/g, '')}`;

      return {
        success: true,
        pageId: response.id,
        url: pageUrl,
      };
    } catch (error) {
      console.error('Failed to export to Notion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test the Notion connection for export
   */
  async testExportConnection(): Promise<boolean> {
    try {
      // Test by trying to list a page (minimal operation)
      await this.client.search({
        page_size: 1,
      });
      return true;
    } catch (error) {
      console.error('Notion export connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const notionExporter = new NotionExporter();