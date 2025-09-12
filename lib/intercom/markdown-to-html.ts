import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkGfm from 'remark-gfm';

export async function markdownToHtml(markdown: string): Promise<string> {
  try {
    const result = await remark()
      .use(remarkGfm) // Support GitHub Flavored Markdown
      .use(remarkHtml, { sanitize: false }) // Don't sanitize HTML since Intercom will handle it
      .process(markdown);

    return result.toString();
  } catch (error) {
    console.error('Error converting markdown to HTML:', error);
    throw new Error('Failed to convert markdown to HTML');
  }
}