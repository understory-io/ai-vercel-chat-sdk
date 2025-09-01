'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NotionIcon } from './notion-slack-icons';
import { CheckCircleFillIcon } from './icons';
import { X, AlertCircle, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

interface NotionPage {
  id: string;
  title: string;
  path: string;
  lastModified: string;
}

interface NotionApiResponse {
  success: boolean;
  pages?: NotionPage[];
  error?: string;
  code?: string;
  source?: string;
  timestamp: number;
  total?: number;
  totalInDatabase?: number;
}

type LoadingState = 'idle' | 'loading' | 'error' | 'success';

interface ErrorState {
  message: string;
  code?: string;
  canRetry: boolean;
}

interface NotionSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selectedPages: NotionPage[]) => void;
}

interface ContentFetchResult {
  id: string;
  content?: string;
  status: 'success' | 'error';
  error?: string;
}

export function NotionSelectorModal({
  open,
  onOpenChange,
  onSelect,
}: NotionSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPages, setSelectedPages] = useState<NotionPage[]>([]);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<ErrorState | null>(null);
  const [navigationIndex, setNavigationIndex] = useState(-1);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalInDatabase, setTotalInDatabase] = useState<number>(0);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [contentProgress, setContentProgress] = useState<number>(0);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch pages from API
  const fetchPages = useCallback(async (query?: string) => {
    setLoadingState('loading');
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query?.trim()) {
        params.set('q', query.trim());
      }

      const response = await fetch(`/api/notion/pages?${params}`);
      const data: NotionApiResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch pages');
      }

      setPages(data.pages || []);
      setTotalPages(data.total || 0);
      setTotalInDatabase(data.totalInDatabase || data.total || 0);
      setLoadingState('success');

      // Show success toast for initial load only
      if (data.source === 'api_all' && (!query || query.trim() === '')) {
        toast.success(`Loaded ${data.totalInDatabase || 0} pages from database`);
      }

    } catch (err) {
      console.error('Error fetching Notion pages:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pages';
      
      setError({
        message: errorMessage,
        code: 'FETCH_ERROR',
        canRetry: true
      });
      setLoadingState('error');
      setPages([]);

      // Show error toast
      toast.error(errorMessage);
    }
  }, []);

// Load all pages function  
const loadAllPages = useCallback(async () => {
  setLoadingState('loading');
  setError(null);
  
  try {
    const response = await fetch('/api/notion/pages');
    const data: NotionApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch pages');
    }

    setPages(data.pages || []);
    setTotalPages(data.total || 0);
    setTotalInDatabase(data.totalInDatabase || data.total || 0);
    setLoadingState('success');
    
    toast.success(`Loaded ${data.totalInDatabase || 0} pages from database`);
  } catch (err) {
    console.error('Error loading pages:', err);
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pages';
    
    setError({
      message: errorMessage,
      code: 'FETCH_ERROR',
      canRetry: true
    });
    setLoadingState('error');
    setPages([]);
    
    toast.error(errorMessage);
  }
}, []);

// Initial load when modal opens
useEffect(() => {
  if (open) {
    // Reset state when opening
    setSelectedPages([]);
    setSearchQuery('');
    setDebouncedQuery('');
    setNavigationIndex(-1);
    setError(null);
    setTotalPages(0);
    
    // Fetch ALL pages immediately on open
    loadAllPages();
  }
}, [open, loadAllPages]);

  // Fetch when debounced query changes
  useEffect(() => {
    if (open) {
      // Always fetch when debouncedQuery changes
      fetchPages(debouncedQuery || undefined);
    }
  }, [debouncedQuery, open, fetchPages]);

  // Pages are already filtered by the API, no need for client-side filtering
  const filteredPages = pages;

  // Reset navigation index when pages change
  useEffect(() => {
    if (filteredPages.length > 0) {
      setNavigationIndex(0);
    } else {
      setNavigationIndex(-1);
    }
  }, [filteredPages]);

  // Reset navigation when modal opens
  useEffect(() => {
    if (open) {
      setNavigationIndex(-1);
    }
  }, [open]);

  const togglePageSelection = (page: NotionPage) => {
    setSelectedPages((prev) => {
      const isSelected = prev.some((p) => p.id === page.id);
      if (isSelected) {
        return prev.filter((p) => p.id !== page.id);
      } else {
        return [...prev, page];
      }
    });
  };

  const handleSelect = async () => {
    if (selectedPages.length === 0) return;
    
    setIsLoadingContent(true);
    setContentProgress(0);
    
    try {
      // Fetch content for all selected pages
      const response = await fetch('/api/notion/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          pageIds: selectedPages.map(p => p.id) 
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch page content');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch content');
      }
      
      // Merge content with page metadata
      const pagesWithContent = selectedPages.map(page => {
        const contentResult = data.results.find((r: ContentFetchResult) => r.id === page.id);
        return {
          ...page,
          content: contentResult?.content || '',
          contentStatus: contentResult?.status === 'success' ? 'loaded' as const : 'error' as const,
          contentError: contentResult?.error
        };
      });
      
      const successfulFetches = data.results.filter((r: ContentFetchResult) => r.status === 'success').length;
      
      if (successfulFetches > 0) {
        toast.success(`Loaded content for ${successfulFetches} of ${selectedPages.length} pages`);
      }
      
      if (successfulFetches < selectedPages.length) {
        const failedCount = selectedPages.length - successfulFetches;
        toast.error(`Failed to load content for ${failedCount} pages`);
      }
      
      // Pass pages with content to parent
      onSelect(pagesWithContent);
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error fetching page content:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch content');
      
      // Still allow selection without content (fallback)
      const pagesWithoutContent = selectedPages.map(page => ({
        ...page,
        contentStatus: 'error' as const,
        contentError: 'Failed to fetch content'
      }));
      
      onSelect(pagesWithoutContent);
      onOpenChange(false);
    } finally {
      setIsLoadingContent(false);
      setContentProgress(0);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleRetry = () => {
    if (debouncedQuery.trim()) {
      fetchPages(debouncedQuery);
    } else {
      fetchPages();
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (filteredPages.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setNavigationIndex((prev) => {
          const newIndex = prev < filteredPages.length - 1 ? prev + 1 : prev;
          // Scroll into view
          setTimeout(() => {
            const element = document.querySelector(`[data-page-index="${newIndex}"]`);
            element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setNavigationIndex((prev) => {
          const newIndex = prev > 0 ? prev - 1 : 0;
          // Scroll into view
          setTimeout(() => {
            const element = document.querySelector(`[data-page-index="${newIndex}"]`);
            element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 0);
          return newIndex;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (navigationIndex >= 0 && navigationIndex < filteredPages.length) {
          togglePageSelection(filteredPages[navigationIndex]);
        }
        break;
    }
  };

  // Add keyboard event listener
  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [open, filteredPages, navigationIndex]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Fixed Header with Search Bar */}
          <div className="flex items-center gap-3 p-6 border-b bg-background">
            <NotionIcon size={20} />
            <div className="flex-1">
              <div className="relative">
                <Input
                  placeholder="Search database pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-muted/50 placeholder:text-muted-foreground/60 pr-8"
                  autoFocus
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-6 p-0 hover:bg-muted rounded-sm"
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
              {totalInDatabase > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground">
                    {searchQuery ? (
                      `Found ${totalPages} of ${totalInDatabase} pages`
                    ) : (
                      `${totalInDatabase} pages in database`
                    )}
                  </div>
                </div>
              )}
            </div>
            <Button
              onClick={handleSelect}
              disabled={selectedPages.length === 0 || isLoadingContent}
              className="px-4 py-2 shrink-0"
            >
              {isLoadingContent ? (
                <>
                  <RefreshCw className="size-3 animate-spin mr-1" />
                  Loading...
                </>
              ) : (
                `Add ${selectedPages.length > 0 ? selectedPages.length : ''}`
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="shrink-0 rounded-md hover:bg-muted"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            {loadingState === 'loading' ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2">
                  <RefreshCw className="size-4 animate-spin" />
                  <div className="text-sm text-muted-foreground">Loading pages...</div>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center max-w-md">
                  <AlertCircle className="size-8 text-red-500 mx-auto mb-3" />
                  <div className="text-sm font-medium text-foreground mb-1">Failed to load pages</div>
                  <div className="text-xs text-muted-foreground mb-4">
                    {error.message}
                  </div>
                  {error.canRetry && (
                    <Button
                      onClick={handleRetry}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      <RefreshCw className="size-3 mr-1" />
                      Try Again
                    </Button>
                  )}
                </div>
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">No pages found</div>
                  {searchQuery && (
                    <div className="text-xs text-muted-foreground/60 mt-1">
                      Try adjusting your search terms
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-2">
                {filteredPages.map((page, index) => {
                  const isSelected = selectedPages.some((p) => p.id === page.id);
                  const isNavigated = navigationIndex === index;
                  return (
                    <motion.div
                      key={page.id}
                      data-page-index={index}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`group relative mx-2 mb-1 p-3 cursor-pointer rounded-md transition-all duration-150 border ${
                        isSelected 
                          ? 'bg-primary/5 border-primary/20' 
                          : isNavigated
                          ? 'border-border/50 bg-muted/50'
                          : 'border-transparent hover:border-border/50 hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        setNavigationIndex(index);
                        togglePageSelection(page);
                      }}
                      onMouseEnter={() => setNavigationIndex(index)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <h4 className="text-sm font-medium text-foreground truncate">
                            {page.title}
                          </h4>
                          <span className="text-xs text-muted-foreground/60 truncate">
                            {page.path}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircleFillIcon size={16} />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}