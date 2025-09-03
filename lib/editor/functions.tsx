'use client';

import { type MarkdownParser, defaultMarkdownSerializer, defaultMarkdownParser } from 'prosemirror-markdown';
import { DOMParser, type Node } from 'prosemirror-model';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { renderToString } from 'react-dom/server';

import { Markdown } from '@/components/markdown';

import { createSuggestionWidget, type UISuggestion } from './suggestions';

// Lazy-loaded markdown parser to avoid circular dependency issues
let markdownParser: MarkdownParser | null = null;

const getMarkdownParser = () => {
  if (!markdownParser) {
    // Use the default markdown parser - works well for standard markdown and Notion export
    markdownParser = defaultMarkdownParser;
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
