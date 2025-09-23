'use client';

import React, { useState, useRef } from 'react';
import { EditorView } from 'prosemirror-view';
import { toggleMark, setBlockType } from 'prosemirror-commands';
import { wrapInList, liftListItem } from 'prosemirror-schema-list';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Bold,
  Italic,
  Underline,
  Link2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editorView: EditorView | null;
}

export function EditorToolbar({ editorView }: EditorToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);
  const executeCommand = (command: any) => {
    if (!editorView) return;

    const { state, dispatch } = editorView;
    command(state, dispatch);
    editorView.focus();
  };

  const toggleBold = () => {
    if (!editorView) return;
    const { state } = editorView;
    executeCommand(toggleMark(state.schema.marks.strong));
  };

  const toggleItalic = () => {
    if (!editorView) return;
    const { state } = editorView;
    executeCommand(toggleMark(state.schema.marks.em));
  };

  const toggleUnderline = () => {
    if (!editorView) return;
    const { state } = editorView;
    // ProseMirror doesn't have underline by default, we'll use code mark as a placeholder
    // You can add a custom underline mark to the schema if needed
    executeCommand(toggleMark(state.schema.marks.code));
  };

  const toggleLink = () => {
    if (!editorView) return;
    const { state } = editorView;
    const { from, to } = state.selection;

    // Check if there's already a link at the selection
    const existingLink = state.doc.rangeHasMark(from, to, state.schema.marks.link);

    if (existingLink) {
      // Remove existing link
      const tr = state.tr.removeMark(from, to, state.schema.marks.link);
      editorView.dispatch(tr);
      setShowLinkInput(false);
    } else {
      // Show link input
      const selectedText = state.doc.textBetween(from, to);
      const defaultUrl = selectedText.startsWith('http') ? selectedText : 'https://';
      setLinkUrl(defaultUrl);
      setShowLinkInput(true);
      // Focus the input after a brief delay to ensure it's rendered
      setTimeout(() => {
        linkInputRef.current?.focus();
      }, 10);
    }
  };

  const addLink = () => {
    if (!editorView || !linkUrl.trim()) return;

    const { state, dispatch } = editorView;
    const { from, to } = state.selection;

    const linkMark = state.schema.marks.link.create({ href: linkUrl.trim() });
    const tr = state.tr.addMark(from, to, linkMark);
    dispatch(tr);

    setShowLinkInput(false);
    setLinkUrl('');
    editorView.focus();
  };

  const cancelLink = () => {
    setShowLinkInput(false);
    setLinkUrl('');
    editorView?.focus();
  };

  const setHeading = (level: number) => {
    if (!editorView) return;
    const { state } = editorView;

    // If the current heading level is already active, toggle back to paragraph
    if (isHeadingActive(level)) {
      executeCommand(setBlockType(state.schema.nodes.paragraph));
    } else {
      executeCommand(setBlockType(state.schema.nodes.heading, { level }));
    }
  };

  const setParagraph = () => {
    if (!editorView) return;
    const { state } = editorView;
    executeCommand(setBlockType(state.schema.nodes.paragraph));
  };

  const applyListType = (listType: 'bullet_list' | 'ordered_list') => {
    if (!editorView) return;
    const { state, dispatch } = editorView;
    const { $from } = state.selection;

    // Find the current list node if we're in one
    let currentListType = null;
    let listDepth = -1;

    for (let i = $from.depth; i >= 0; i--) {
      const node = $from.node(i);
      if (node.type.name === 'bullet_list' || node.type.name === 'ordered_list') {
        currentListType = node.type.name;
        listDepth = i;
        break;
      }
    }

    if (currentListType === listType) {
      // Same list type - remove list
      const liftCommand = liftListItem(state.schema.nodes.list_item);
      liftCommand(state, dispatch);
    } else if (currentListType) {
      // Different list type - transform the list
      const listPos = $from.before(listDepth);
      const listNode = $from.node(listDepth);

      // Create new list with same content but different type
      const newList = state.schema.nodes[listType].create(
        null,
        listNode.content
      );

      const tr = state.tr.replaceWith(
        listPos,
        listPos + listNode.nodeSize,
        newList
      );

      dispatch(tr);
    } else {
      // Not in a list - create new list
      const wrapCommand = wrapInList(state.schema.nodes[listType]);
      wrapCommand(state, dispatch);
    }

    editorView.focus();
  };

  const toggleBulletList = () => {
    applyListType('bullet_list');
  };

  const toggleOrderedList = () => {
    applyListType('ordered_list');
  };


  const isMarkActive = (markType: any) => {
    if (!editorView) return false;
    const { state } = editorView;
    const { from, to } = state.selection;
    return state.doc.rangeHasMark(from, to, markType);
  };

  const isHeadingActive = (level: number) => {
    if (!editorView) return false;
    const { state } = editorView;
    const { $from } = state.selection;
    const node = $from.parent;
    return node.type.name === 'heading' && node.attrs.level === level;
  };

  const isListActive = (listType: string) => {
    if (!editorView) return false;
    const { state } = editorView;
    const { $from } = state.selection;

    // Check if we're inside a list item
    for (let i = $from.depth; i >= 0; i--) {
      const node = $from.node(i);
      if (node.type.name === listType) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto">
      {showLinkInput ? (
        // Link input interface
        <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-lg border">
          <Input
            ref={linkInputRef}
            type="url"
            placeholder="Enter URL..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLink();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelLink();
              }
            }}
            className="h-7 text-sm min-w-[200px]"
          />
          <Button
            size="sm"
            onClick={addLink}
            disabled={!linkUrl.trim()}
            className="h-7 px-3 text-xs"
          >
            Add
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={cancelLink}
            className="h-7 px-2 text-xs"
          >
            ✕
          </Button>
        </div>
      ) : (
        <>
          {/* Text Formatting */}
          <ToggleGroup type="multiple" className="gap-0.5">
          <ToggleGroupItem
            value="bold"
            aria-label="Toggle bold"
            onClick={toggleBold}
            className={cn(
              "h-9 w-9 p-0 rounded-lg transition-all duration-200",
              editorView && isMarkActive(editorView.state.schema.marks.strong) && "bg-primary text-primary-foreground"
            )}
          >
            <Bold className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="italic"
            aria-label="Toggle italic"
            onClick={toggleItalic}
            className={cn(
              "h-9 w-9 p-0 rounded-lg transition-all duration-200",
              editorView && isMarkActive(editorView.state.schema.marks.em) && "bg-primary text-primary-foreground"
            )}
          >
            <Italic className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="underline"
            aria-label="Toggle underline"
            onClick={toggleUnderline}
            className={cn(
              "h-9 w-9 p-0 rounded-lg transition-all duration-200",
              editorView && isMarkActive(editorView.state.schema.marks.code) && "bg-primary text-primary-foreground"
            )}
          >
            <Underline className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="link"
            aria-label="Add link"
            onClick={toggleLink}
            className={cn(
              "h-9 w-9 p-0 rounded-lg transition-all duration-200",
              editorView && isMarkActive(editorView.state.schema.marks.link) && "bg-primary text-primary-foreground"
            )}
          >
            <Link2 className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <Separator orientation="vertical" className="h-7 mx-1.5 opacity-20" />

        {/* Headings */}
        <ToggleGroup type="single" className="gap-0.5">
          <ToggleGroupItem
            value="h1"
            aria-label="Heading 1"
            onClick={() => setHeading(1)}
            className={cn(
              "h-9 px-3 rounded-lg font-bold text-base transition-all duration-200",
              isHeadingActive(1) && "bg-primary text-primary-foreground"
            )}
          >
            H1
          </ToggleGroupItem>
          <ToggleGroupItem
            value="h2"
            aria-label="Heading 2"
            onClick={() => setHeading(2)}
            className={cn(
              "h-9 px-3 rounded-lg font-bold text-sm transition-all duration-200",
              isHeadingActive(2) && "bg-primary text-primary-foreground"
            )}
          >
            H2
          </ToggleGroupItem>
          <ToggleGroupItem
            value="h3"
            aria-label="Heading 3"
            onClick={() => setHeading(3)}
            className={cn(
              "h-9 px-3 rounded-lg font-bold text-xs transition-all duration-200",
              isHeadingActive(3) && "bg-primary text-primary-foreground"
            )}
          >
            H3
          </ToggleGroupItem>
          <ToggleGroupItem
            value="h4"
            aria-label="Heading 4"
            onClick={() => setHeading(4)}
            className={cn(
              "h-9 px-2.5 rounded-lg font-bold text-xs transition-all duration-200",
              isHeadingActive(4) && "bg-primary text-primary-foreground"
            )}
          >
            H4
          </ToggleGroupItem>
        </ToggleGroup>

        <Separator orientation="vertical" className="h-7 mx-1.5 opacity-20" />

        {/* Lists */}
        <ToggleGroup type="single" className="gap-0.5">
          <ToggleGroupItem
            value="bullet"
            aria-label="Bullet list"
            onClick={toggleBulletList}
            className={cn(
              "h-9 w-9 p-0 rounded-lg transition-all duration-200 hover:bg-muted",
              isListActive('bullet_list') && "bg-primary text-primary-foreground"
            )}
          >
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="ordered"
            aria-label="Ordered list"
            onClick={toggleOrderedList}
            className={cn(
              "h-9 w-9 p-0 rounded-lg transition-all duration-200 hover:bg-muted",
              isListActive('ordered_list') && "bg-primary text-primary-foreground"
            )}
          >
            <ListOrdered className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        </>
      )}
    </div>
  );
}