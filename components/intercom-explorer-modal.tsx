'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Folder, FileText, ChevronRight, ArrowLeft, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { htmlToText } from '@/lib/html-to-text';

interface IntercomCollection {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  children: IntercomCollection[];
}

interface IntercomArticle {
  id: string;
  title: string;
  description?: string;
  body?: string;
  author_id?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
  parent_id?: string | number;
  parent_ids?: (string | number)[];
  parent_type?: string;
}

interface IntercomExplorerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (articles: IntercomArticle[]) => void;
}

type ViewState = {
  type: 'root' | 'collection';
  collection?: IntercomCollection;
  path: { id: string; name: string }[];
};

export function IntercomExplorerModal({
  open,
  onOpenChange,
  onSelect,
}: IntercomExplorerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticles, setSelectedArticles] = useState<IntercomArticle[]>([]);
  const [rootCollections, setRootCollections] = useState<IntercomCollection[]>([]);
  const [currentArticles, setCurrentArticles] = useState<IntercomArticle[]>([]);
  const [allArticlesCache, setAllArticlesCache] = useState<IntercomArticle[]>([]);
  const [collectionToArticlesMap, setCollectionToArticlesMap] = useState<Map<string, IntercomArticle[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({
    type: 'root',
    path: [],
  });

  // Fetch collections and articles metadata when modal opens
  useEffect(() => {
    if (open) {
      fetchCollections();
      fetchAllArticlesMetadata();
    } else {
      // Reset state when modal closes
      setSelectedArticles([]);
      setViewState({ type: 'root', path: [] });
      setSearchQuery('');
      setCurrentArticles([]);
    }
  }, [open]);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/intercom/collections');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Collections API error:', errorData);
        throw new Error(`Failed to fetch collections: ${response.statusText}`);
      }

      const data = await response.json();
      setRootCollections(data.collections || []);
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast.error('Failed to load help center collections');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllArticlesMetadata = async () => {
    try {
      const response = await fetch('/api/intercom/articles/helpcenter?metadata_only=true');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Articles metadata API error:', errorData);
        throw new Error(`Failed to fetch articles metadata: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache all articles
      setAllArticlesCache(data.articles || []);

      // Build collection-to-articles lookup map
      const map = new Map<string, IntercomArticle[]>();

      (data.articles || []).forEach((article: IntercomArticle) => {
        // Handle parent_ids array (articles in multiple collections)
        if (article.parent_ids && Array.isArray(article.parent_ids) && article.parent_ids.length > 0) {
          article.parent_ids.forEach(parentId => {
            const parentIdString = String(parentId);
            const existing = map.get(parentIdString) || [];
            map.set(parentIdString, [...existing, article]);
          });
        }
        // Fallback to parent_id if parent_ids is empty/null
        else if (article.parent_id && article.parent_type === 'collection') {
          const parentIdString = String(article.parent_id);
          const existing = map.get(parentIdString) || [];
          map.set(parentIdString, [...existing, article]);
        }
      });

      setCollectionToArticlesMap(map);
    } catch (error) {
      console.error('Error fetching articles metadata:', error);
      toast.error('Failed to load articles metadata');
    }
  };

  const getArticlesForCollection = (collectionId: string): IntercomArticle[] => {
    return collectionToArticlesMap.get(collectionId) || [];
  };

  const navigateToCollection = (collection: IntercomCollection) => {
    const newPath = [...viewState.path, { id: collection.id, name: collection.name }];
    setViewState({
      type: 'collection',
      collection,
      path: newPath,
    });

    // Get articles from cache for this collection (instant)
    const articles = getArticlesForCollection(collection.id);
    setCurrentArticles(articles);
  };

  const navigateBack = () => {
    if (viewState.path.length <= 1) {
      // Go back to root
      setViewState({ type: 'root', path: [] });
      setCurrentArticles([]);
    } else {
      // Go back one level
      const newPath = viewState.path.slice(0, -1);
      const parentId = newPath[newPath.length - 1]?.id;

      // Find parent collection
      const findCollection = (collections: IntercomCollection[], id: string): IntercomCollection | null => {
        for (const col of collections) {
          if (col.id === id) return col;
          const found = findCollection(col.children, id);
          if (found) return found;
        }
        return null;
      };

      const parentCollection = parentId ? findCollection(rootCollections, parentId) : null;

      if (parentCollection) {
        setViewState({
          type: 'collection',
          collection: parentCollection,
          path: newPath,
        });
        // Get articles from cache (instant)
        const articles = getArticlesForCollection(parentCollection.id);
        setCurrentArticles(articles);
      } else {
        setViewState({ type: 'root', path: [] });
        setCurrentArticles([]);
      }
    }
  };

  const toggleArticleSelection = (article: IntercomArticle) => {
    setSelectedArticles(prev => {
      const isSelected = prev.some(a => a.id === article.id);
      if (isSelected) {
        return prev.filter(a => a.id !== article.id);
      } else {
        return [...prev, article];
      }
    });
  };

  const handleConfirm = async () => {
    if (selectedArticles.length === 0) {
      toast.error('Please select at least one article');
      return;
    }

    // Fetch full article content for selected articles
    setLoading(true);
    try {
      const articlesWithContent = await Promise.all(
        selectedArticles.map(async (article) => {
          const response = await fetch(`/api/intercom/articles/${article.id}`);
          if (!response.ok) throw new Error(`Failed to fetch article ${article.id}`);
          const fullArticle = await response.json();

          // Return article with clean text content
          const cleanBody = fullArticle.body ? htmlToText(fullArticle.body) : '';

          return {
            ...article,
            body: cleanBody,
            description: fullArticle.description || article.description,
          };
        })
      );

      onSelect(articlesWithContent);
      onOpenChange(false);
    } catch (error) {
      console.error('Error fetching article content:', error);
      toast.error('Failed to load article content');
    } finally {
      setLoading(false);
    }
  };

  const currentCollections = viewState.type === 'root'
    ? rootCollections
    : (viewState.collection?.children || []);

  const filteredCollections = currentCollections.filter(col =>
    col.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredArticles = currentArticles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={() => onOpenChange(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 w-full max-w-2xl bg-background rounded-lg shadow-xl"
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                {viewState.path.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigateBack();
                    }}
                    className="p-1"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                )}
                <h2 className="text-lg font-semibold">
                  {viewState.path.length === 0
                    ? 'Help Center Collections'
                    : viewState.path.map(p => p.name).join(' > ')}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenChange(false);
                }}
                className="p-1"
              >
                <X className="size-5" />
              </Button>
            </div>

            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search collections and articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading collections...
                  </div>
                ) : (
                  <>
                    {/* Collections */}
                    {filteredCollections.map((collection) => (
                      <button
                        key={collection.id}
                        type="button"
                        onClick={() => navigateToCollection(collection)}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <Folder className="size-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{collection.name}</div>
                            {collection.description && (
                              <div className="text-sm text-muted-foreground">
                                {collection.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </button>
                    ))}

                    {/* Articles */}
                    {filteredArticles.map((article) => (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => toggleArticleSelection(article)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                          selectedArticles.some(a => a.id === article.id)
                            ? 'bg-primary/10 hover:bg-primary/15'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className="size-5 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{article.title}</div>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                article.state === 'published'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                              }`}>
                                {article.state}
                              </span>
                            </div>
                            {article.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {article.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {selectedArticles.some(a => a.id === article.id) && (
                          <div className="size-5 rounded-full bg-primary flex items-center justify-center">
                            <svg
                              className="size-3 text-primary-foreground"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="3"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {selectedArticles.length > 0 && (
              <div className="p-4 border-t bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {selectedArticles.length} article{selectedArticles.length !== 1 ? 's' : ''} selected
                  </span>
                  <Button
                    onClick={handleConfirm}
                    disabled={loading}
                    size="sm"
                  >
                    Add to Context
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}