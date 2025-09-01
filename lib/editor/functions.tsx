'use client';

import { MarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { DOMParser, type Node } from 'prosemirror-model';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { renderToString } from 'react-dom/server';

import { Markdown } from '@/components/markdown';

import { createSuggestionWidget, type UISuggestion } from './suggestions';

// Lazy-loaded markdown parser to avoid circular dependency issues
let markdownParser: MarkdownParser | null = null;

const getMarkdownParser = () => {
  if (!markdownParser) {
    // Import documentSchema here to avoid circular dependency
    const { documentSchema } = require('./config');
    
    // Use a simplified markdown parser configuration that works with the schema
    markdownParser = new MarkdownParser(documentSchema, {
      blockquote: { block: 'blockquote' },
      paragraph: { block: 'paragraph' },
      list_item: { block: 'list_item' },
      bullet_list: { block: 'bullet_list' },
      ordered_list: { block: 'ordered_list' },
      heading: {
        block: 'heading',
        getAttrs: (tok: any) => ({ level: Math.min(6, Math.max(1, +(tok.tag?.slice(1) || 1))) }),
      },
      code_block: { block: 'code_block' },
      fence: { 
        block: 'code_block', 
        getAttrs: (tok: any) => ({ params: tok.info || '' }),
      },
      hr: { node: 'horizontal_rule' },
      hardbreak: { node: 'hard_break' },
      em: { mark: 'em' },
      strong: { mark: 'strong' },
      code_inline: { mark: 'code' },
    } as any, {
      em: '_',
      strong: '__',
      code_inline: '`',
    });
  }
  return markdownParser;
};

export const buildDocumentFromContent = (content: string) => {
  try {
    // First try using the direct markdown parser
    const parser = getMarkdownParser();
    return parser.parse(content);
  } catch (error) {
    // Fallback to the original method if markdown parsing fails
    console.warn('Direct markdown parsing failed, falling back to DOM parsing:', error);
    const { documentSchema } = require('./config');
    const parser = DOMParser.fromSchema(documentSchema);
    const stringFromMarkdown = renderToString(<Markdown>{content}</Markdown>);
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = stringFromMarkdown;
    return parser.parse(tempContainer);
  }
};

export const buildContentFromDocument = (document: Node) => {
  return defaultMarkdownSerializer.serialize(document);
};

export const createDecorations = (
  suggestions: Array<UISuggestion>,
  view: EditorView,
) => {
  const decorations: Array<Decoration> = [];

  for (const suggestion of suggestions) {
    decorations.push(
      Decoration.inline(
        suggestion.selectionStart,
        suggestion.selectionEnd,
        {
          class: 'suggestion-highlight',
        },
        {
          suggestionId: suggestion.id,
          type: 'highlight',
        },
      ),
    );

    decorations.push(
      Decoration.widget(
        suggestion.selectionStart,
        (view) => {
          const { dom } = createSuggestionWidget(suggestion, view);
          return dom;
        },
        {
          suggestionId: suggestion.id,
          type: 'widget',
        },
      ),
    );
  }

  return DecorationSet.create(view.state.doc, decorations);
};
