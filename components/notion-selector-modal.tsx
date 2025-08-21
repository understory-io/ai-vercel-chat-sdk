'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NotionIcon } from './notion-slack-icons';
import { CheckCircleFillIcon } from './icons';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface NotionPage {
  id: string;
  title: string;
  path: string;
  lastModified: string;
}

interface NotionSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selectedPages: NotionPage[]) => void;
}

export function NotionSelectorModal({
  open,
  onOpenChange,
  onSelect,
}: NotionSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPages, setSelectedPages] = useState<NotionPage[]>([]);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [navigationIndex, setNavigationIndex] = useState(-1);

  // Mock data for now - will be replaced with MCP integration
  const mockPages: NotionPage[] = [
    {
      id: '1',
      title: 'Product Requirements Document',
      path: 'Product Docs / ... / Fin Product Docs',
      lastModified: '2 hours ago',
    },
    {
      id: '2',
      title: 'API Documentation',
      path: 'Product Docs / Technical / API Reference',
      lastModified: '1 day ago',
    },
    {
      id: '3',
      title: 'User Research Findings',
      path: 'Research / User Studies / Q2 2024',
      lastModified: '3 days ago',
    },
    {
      id: '4',
      title: 'Feature Specifications',
      path: 'Product Docs / Features / Core Features',
      lastModified: '1 week ago',
    },
    {
      id: '5',
      title: 'Automated Report Access',
      path: 'Product Docs / ... / Fin Product Docs',
      lastModified: '2 days ago',
    },
    {
      id: '6',
      title: 'Resource Management',
      path: 'General / ... / Opportunities',
      lastModified: '5 days ago',
    },
    {
      id: '7',
      title: 'Marketing Strategy Q1 2024',
      path: 'Marketing / Strategy / Quarterly Plans',
      lastModified: '1 week ago',
    },
    {
      id: '8',
      title: 'Engineering Onboarding Guide',
      path: 'Engineering / Documentation / Onboarding',
      lastModified: '2 weeks ago',
    },
    {
      id: '9',
      title: 'Customer Interview Notes',
      path: 'Research / Interviews / Customer Feedback',
      lastModified: '3 days ago',
    },
    {
      id: '10',
      title: 'Security Audit Report',
      path: 'Security / Audits / 2024 Q1',
      lastModified: '1 month ago',
    },
    {
      id: '11',
      title: 'Database Schema Design',
      path: 'Engineering / Database / Architecture',
      lastModified: '1 week ago',
    },
    {
      id: '12',
      title: 'Brand Guidelines v2.0',
      path: 'Design / Brand / Guidelines',
      lastModified: '2 months ago',
    },
    {
      id: '13',
      title: 'Sales Playbook',
      path: 'Sales / Resources / Playbooks',
      lastModified: '3 weeks ago',
    },
    {
      id: '14',
      title: 'A/B Testing Results Dashboard',
      path: 'Analytics / Testing / Results',
      lastModified: '5 days ago',
    },
    {
      id: '15',
      title: 'Mobile App Wireframes',
      path: 'Design / Mobile / Wireframes',
      lastModified: '1 week ago',
    },
    {
      id: '16',
      title: 'Compliance Documentation',
      path: 'Legal / Compliance / GDPR',
      lastModified: '2 months ago',
    },
    {
      id: '17',
      title: 'Performance Metrics Q4',
      path: 'Analytics / Performance / Quarterly',
      lastModified: '1 month ago',
    },
    {
      id: '18',
      title: 'Team Retrospective Notes',
      path: 'Team / Retrospectives / Sprint 23',
      lastModified: '1 week ago',
    },
    {
      id: '19',
      title: 'Competitor Analysis Report',
      path: 'Research / Competitive / Market Analysis',
      lastModified: '2 weeks ago',
    },
    {
      id: '20',
      title: 'Infrastructure Monitoring Setup',
      path: 'Engineering / DevOps / Monitoring',
      lastModified: '4 days ago',
    },
  ];

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      // Reset state when opening
      setSelectedPages([]);
      setSearchQuery('');
      // Simulate API call
      setTimeout(() => {
        setPages(mockPages);
        setIsLoading(false);
      }, 300);
    }
  }, [open]);

  const filteredPages = pages.filter((page) =>
    page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset navigation index when search changes
  useEffect(() => {
    if (filteredPages.length > 0) {
      setNavigationIndex(0);
    } else {
      setNavigationIndex(-1);
    }
  }, [searchQuery]);

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

  const handleSelect = () => {
    onSelect(selectedPages);
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
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
            <div className="flex-1 relative">
              <Input
                placeholder="Search pages and workspaces..."
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
            <Button
              onClick={handleSelect}
              disabled={selectedPages.length === 0}
              className="px-4 py-2 shrink-0"
            >
              Add {selectedPages.length > 0 && selectedPages.length}
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
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-sm text-muted-foreground">Loading pages...</div>
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