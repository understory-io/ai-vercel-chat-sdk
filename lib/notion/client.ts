import { Client } from '@notionhq/client';

export interface NotionPage {
  id: string;
  title: string;
  path: string;
  lastModified: string;
  lastEditedTime: string; // ISO timestamp for sorting
}

export interface NotionPageWithContent extends NotionPage {
  content?: string;
  contentStatus?: 'pending' | 'loading' | 'loaded' | 'error';
  contentError?: string;
}

export interface NotionSearchResult {
  pages: NotionPage[];
  hasMore: boolean;
  nextCursor?: string;
}

export class NotionService {
  private client: Client;
  private databaseId: string;

  constructor() {
    const token = process.env.NOTION_TOKEN;
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    if (!token) {
      throw new Error('NOTION_TOKEN environment variable is required');
    }
    
    if (!databaseId) {
      throw new Error('NOTION_DATABASE_ID environment variable is required');
    }
    
    this.client = new Client({
      auth: token,
    });
    
    this.databaseId = databaseId;
  }

  /**
   * Test the Notion connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to search with a minimal query to test auth
      await this.client.search({
        page_size: 1,
      });
      return true;
    } catch (error) {
      console.error('Notion connection test failed:', error);
      return false;
    }
  }

  /**
   * Query pages from the configured database
   */
  async searchPages(query?: string, startCursor?: string): Promise<NotionSearchResult> {
    try {
      const queryParams: any = {
        page_size: 100,
        sorts: [{
          timestamp: 'last_edited_time',
          direction: 'descending'
        }]
      };

      // Add text search filter if query provided
      if (query?.trim()) {
        queryParams.filter = {
          or: [
            {
              property: 'Name', // Most databases have a Name property
              title: {
                contains: query.trim()
              }
            },
            // Add more searchable properties as fallback
            {
              property: 'Title',
              title: {
                contains: query.trim()
              }
            }
          ]
        };
      }

      if (startCursor) {
        queryParams.start_cursor = startCursor;
      }

      const response = await this.client.databases.query({
        database_id: this.databaseId,
        ...queryParams
      });

      const pages = response.results
        .map(page => this.transformDatabasePageToNotionPage(page));

      return {
        pages,
        hasMore: response.has_more,
        nextCursor: response.next_cursor || undefined
      };
    } catch (error) {
      console.error('Error querying Notion database:', error);
      throw new Error(`Failed to query Notion database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get recent pages (for caching)
   */
  async getRecentPages(limit = 100): Promise<NotionPage[]> {
    const result = await this.searchPages(undefined);
    return result.pages.slice(0, limit);
  }

  /**
   * Get all pages from database with pagination
   */
  async getAllPages(): Promise<NotionPage[]> {
    const allPages: NotionPage[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore && allPages.length < 1000) { // Safety limit
      const result = await this.searchPages(undefined, cursor);
      allPages.push(...result.pages);
      hasMore = result.hasMore;
      cursor = result.nextCursor;
    }

    // Sort by last edited time (most recent first) using ISO timestamps
    return allPages.sort((a, b) => {
      const dateA = new Date(a.lastEditedTime).getTime();
      const dateB = new Date(b.lastEditedTime).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  }

  /**
   * Get page content (all blocks)
   */
  async getPageContent(pageId: string): Promise<string> {
    try {
      const blocks = await this.fetchAllBlocks(pageId);
      return this.blocksToMarkdown(blocks);
    } catch (error) {
      console.error(`Error fetching content for page ${pageId}:`, error);
      throw new Error(`Failed to fetch page content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch all blocks from a page (handles pagination)
   */
  private async fetchAllBlocks(blockId: string): Promise<any[]> {
    const blocks: any[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: cursor
      });

      blocks.push(...response.results);
      hasMore = response.has_more;
      cursor = response.next_cursor || undefined;
    }

    // Fetch child blocks recursively
    for (const block of blocks) {
      if (block.has_children) {
        block.children = await this.fetchAllBlocks(block.id);
      }
    }

    return blocks;
  }

  /**
   * Convert Notion blocks to markdown/text
   */
  private blocksToMarkdown(blocks: any[], depth = 0): string {
    const indent = '  '.repeat(depth);
    const lines: string[] = [];

    for (const block of blocks) {
      const text = this.extractTextFromBlock(block);
      
      switch (block.type) {
        case 'paragraph':
          if (text) lines.push(`${indent}${text}`);
          break;
        
        case 'heading_1':
          lines.push(`${indent}# ${text}`);
          break;
        
        case 'heading_2':
          lines.push(`${indent}## ${text}`);
          break;
        
        case 'heading_3':
          lines.push(`${indent}### ${text}`);
          break;
        
        case 'bulleted_list_item':
          lines.push(`${indent}• ${text}`);
          break;
        
        case 'numbered_list_item':
          lines.push(`${indent}1. ${text}`);
          break;
        
        case 'to_do': {
          const checked = block.to_do?.checked ? '✓' : ' ';
          lines.push(`${indent}[${checked}] ${text}`);
          break;
        }
        
        case 'toggle':
          lines.push(`${indent}▶ ${text}`);
          break;
        
        case 'code': {
          const language = block.code?.language || '';
          const code = block.code?.rich_text?.map((t: any) => t.plain_text).join('') || '';
          lines.push(`${indent}\`\`\`${language}`);
          lines.push(code);
          lines.push(`${indent}\`\`\``);
          break;
        }
        
        case 'quote':
          lines.push(`${indent}> ${text}`);
          break;
        
        case 'callout': {
          const icon = block.callout?.icon?.emoji || 'ℹ️';
          lines.push(`${indent}${icon} ${text}`);
          break;
        }
        
        case 'divider':
          lines.push(`${indent}---`);
          break;
        
        case 'table':
          // Tables are complex, just indicate presence
          lines.push(`${indent}[Table with ${block.table?.table_width || 0} columns]`);
          break;
        
        case 'child_page':
          lines.push(`${indent}📄 [${block.child_page?.title || 'Subpage'}]`);
          break;
        
        case 'child_database':
          lines.push(`${indent}🗂️ [${block.child_database?.title || 'Database'}]`);
          break;
        
        case 'embed':
        case 'image':
        case 'video':
        case 'file':
        case 'pdf':
          lines.push(`${indent}[${block.type}: ${block[block.type]?.caption?.[0]?.plain_text || 'Media'}]`);
          break;
        
        default:
          if (text) lines.push(`${indent}${text}`);
      }

      // Add child blocks
      if (block.children && block.children.length > 0) {
        lines.push(this.blocksToMarkdown(block.children, depth + 1));
      }
    }

    return lines.join('\n');
  }

  /**
   * Extract text content from a block
   */
  private extractTextFromBlock(block: any): string {
    const richTextProperty = block[block.type]?.rich_text || block[block.type]?.text;
    
    if (Array.isArray(richTextProperty)) {
      return richTextProperty
        .map((text: any) => text.plain_text)
        .join('');
    }
    
    // For heading blocks
    if (block[block.type]?.text && Array.isArray(block[block.type].text)) {
      return block[block.type].text
        .map((text: any) => text.plain_text)
        .join('');
    }
    
    return '';
  }

  /**
   * Transform Notion database page to our NotionPage format
   */
  private transformDatabasePageToNotionPage(page: any): NotionPage {
    const title = this.extractDatabasePageTitle(page);
    const path = this.extractDatabasePath(page);
    const lastModified = this.formatDate(page.last_edited_time);

    return {
      id: page.id,
      title,
      path,
      lastModified,
      lastEditedTime: page.last_edited_time // Keep ISO timestamp for sorting
    };
  }

  /**
   * Transform Notion API response to our NotionPage format (fallback)
   */
  private transformPageToNotionPage(page: any): NotionPage {
    const title = this.extractTitle(page);
    const path = this.extractPath(page);
    const lastModified = this.formatDate(page.last_edited_time);

    return {
      id: page.id,
      title,
      path,
      lastModified,
      lastEditedTime: page.last_edited_time
    };
  }

  /**
   * Extract title from database page properties
   */
  private extractDatabasePageTitle(page: any): string {
    if (!page.properties) {
      return 'Untitled';
    }

    // Common title property names in Notion databases
    const titlePropertyNames = ['Name', 'Title', 'Page', 'Document'];
    
    for (const propName of titlePropertyNames) {
      const prop = page.properties[propName];
      if (prop?.type === 'title' && prop.title?.length > 0) {
        return prop.title
          .map((text: any) => text.plain_text)
          .join('')
          .trim();
      }
    }

    // Fallback: find any title property
    const titleProp = Object.values(page.properties).find(
      (prop: any) => prop.type === 'title'
    ) as any;

    if (titleProp?.title && titleProp.title.length > 0) {
      return titleProp.title
        .map((text: any) => text.plain_text)
        .join('')
        .trim();
    }

    return 'Untitled';
  }

  /**
   * Extract title from various Notion page property structures (fallback)
   */
  private extractTitle(page: any): string {
    // Try to get title from properties
    if (page.properties) {
      // Look for title property
      const titleProp = Object.values(page.properties).find(
        (prop: any) => prop.type === 'title'
      ) as any;

      if (titleProp?.title && titleProp.title.length > 0) {
        return titleProp.title
          .map((text: any) => text.plain_text)
          .join('')
          .trim();
      }
    }

    // Fallback to page title if available
    if (page.title && Array.isArray(page.title)) {
      const title = page.title
        .map((text: any) => text.plain_text)
        .join('')
        .trim();
      if (title) return title;
    }

    // Last resort fallback
    return 'Untitled';
  }

  /**
   * Extract status from database page properties
   */
  private extractDatabasePath(page: any): string {
    if (!page.properties) {
      return 'No Status';
    }

    // Look for status-related properties first
    const statusProps = ['Status', 'State', 'Progress', 'Phase', 'Stage'];
    
    for (const propName of statusProps) {
      const prop = page.properties[propName];
      if (prop?.type === 'select' && prop.select?.name) {
        return prop.select.name;
      }
      if (prop?.type === 'status' && prop.status?.name) {
        return prop.status.name;
      }
    }

    // Fallback to other categorical properties
    const categoryProps = ['Category', 'Type', 'Priority', 'Team', 'Project'];
    
    for (const propName of categoryProps) {
      const prop = page.properties[propName];
      if (prop?.type === 'select' && prop.select?.name) {
        return prop.select.name;
      }
      if (prop?.type === 'multi_select' && prop.multi_select?.length > 0) {
        return prop.multi_select[0].name; // Take first tag
      }
    }
    
    return 'No Status';
  }

  /**
   * Extract simplified path from page parent information (fallback)
   */
  private extractPath(page: any): string {
    if (!page.parent) {
      return 'Workspace';
    }

    switch (page.parent.type) {
      case 'database_id':
        return 'Database';
      case 'page_id':
        return 'Page / Subpage';
      case 'workspace':
        return 'Workspace';
      case 'block_id':
        return 'Block / Subpage';
      default:
        return 'Workspace';
    }
  }

  /**
   * Format date to human-readable string
   */
  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return years === 1 ? '1 year ago' : `${years} years ago`;
    }
  }
}

// Export singleton instance
export const notionService = new NotionService();