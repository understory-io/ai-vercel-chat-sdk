'use client';

import { exampleSetup } from 'prosemirror-example-setup';
import { inputRules } from 'prosemirror-inputrules';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { memo, useEffect, useRef } from 'react';

import type { Suggestion } from '@/lib/db/schema';
import {
  documentSchema,
  handleTransaction,
  headingRule,
} from '@/lib/editor/config';
import {
  buildContentFromDocument,
  buildDocumentFromContent,
  createDecorations,
} from '@/lib/editor/functions';
import {
  projectWithPositions,
  suggestionsPlugin,
  suggestionsPluginKey,
} from '@/lib/editor/suggestions';

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: 'streaming' | 'idle';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Array<Suggestion>;
  isInline?: boolean;
};

function PureEditor({
  content,
  onSaveContent,
  suggestions,
  status,
  isInline = false,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const state = EditorState.create({
        doc: buildDocumentFromContent(content),
        plugins: [
          ...exampleSetup({ schema: documentSchema, menuBar: false }),
          inputRules({
            rules: [
              headingRule(1),
              headingRule(2),
              headingRule(3),
              headingRule(4),
              headingRule(5),
              headingRule(6),
            ],
          }),
          suggestionsPlugin,
        ],
      });

      editorRef.current = new EditorView(containerRef.current, {
        state,
      });

      // No additional styling needed - let CSS handle it
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // NOTE: we only want to run this effect once
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setProps({
        dispatchTransaction: (transaction) => {
          handleTransaction({
            transaction,
            editorRef,
            onSaveContent,
          });
        },
      });
    }
  }, [onSaveContent]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = buildContentFromDocument(
        editorRef.current.state.doc,
      );

      if (status === 'streaming') {
        const newDocument = buildDocumentFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newDocument.content,
        );

        transaction.setMeta('no-save', true);
        editorRef.current.dispatch(transaction);
        return;
      }

      if (currentContent !== content) {
        const newDocument = buildDocumentFromContent(content);

        const transaction = editorRef.current.state.tr.replaceWith(
          0,
          editorRef.current.state.doc.content.size,
          newDocument.content,
        );

        transaction.setMeta('no-save', true);
        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  useEffect(() => {
    if (editorRef.current?.state.doc && content) {
      const projectedSuggestions = projectWithPositions(
        editorRef.current.state.doc,
        suggestions,
      ).filter(
        (suggestion) => suggestion.selectionStart && suggestion.selectionEnd,
      );

      const decorations = createDecorations(
        projectedSuggestions,
        editorRef.current,
      );

      const transaction = editorRef.current.state.tr;
      transaction.setMeta(suggestionsPluginKey, { decorations });
      editorRef.current.dispatch(transaction);
    }
  }, [suggestions, content]);

  return (
    <div
      className={`
        relative notion-editor
        max-w-none w-full
        prose prose-lg dark:prose-invert
        prose-headings:font-semibold prose-headings:tracking-tight
        prose-h1:text-3xl prose-h1:mt-8 prose-h1:mb-4
        prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3
        prose-h3:text-xl prose-h3:mt-4 prose-h3:mb-2
        prose-p:text-base prose-p:leading-7 prose-p:my-3
        prose-ul:my-4 prose-ol:my-4
        prose-li:my-1
        prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic
        prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
        prose-pre:bg-gray-50 dark:prose-pre:bg-gray-900 prose-pre:border prose-pre:rounded-lg prose-pre:p-4
        [&_.ProseMirror]:outline-none
        [&_.ProseMirror_h1]:text-3xl
        [&_.ProseMirror_h2]:text-2xl
        [&_.ProseMirror_h3]:text-xl
        [&_.ProseMirror_p]:text-base
        [&_.ProseMirror_p]:line-height-7
        [&_.ProseMirror_p:empty:before]:content-['Type_something...']
        [&_.ProseMirror_p:empty:before]:text-gray-400
        [&_.ProseMirror_p:empty:before]:pointer-events-none
        [&_.ProseMirror_p:empty:before]:absolute
        [&_.ProseMirror]:font-normal
      `}
      ref={containerRef}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        minHeight: '300px',
      }}
    />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  return (
    prevProps.suggestions === nextProps.suggestions &&
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === 'streaming' && nextProps.status === 'streaming') &&
    prevProps.content === nextProps.content &&
    prevProps.onSaveContent === nextProps.onSaveContent &&
    prevProps.isInline === nextProps.isInline
  );
}

export const Editor = memo(PureEditor, areEqual);
