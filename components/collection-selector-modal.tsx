'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, ChevronRight, ChevronLeft, Folder } from 'lucide-react';
import { toast } from 'sonner';

interface Collection {
  id: string;
  name: string;
  description?: string;
  parent_id: string | null;
  children: Collection[];
}

interface CollectionSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (collection: Collection, path: Collection[]) => void;
}

// Session cache for collections
let collectionsCache: Collection[] | null = null;

export function CollectionSelectorModal({
  isOpen,
  onClose,
  onSelect,
}: CollectionSelectorModalProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [currentPath, setCurrentPath] = useState<Collection[]>([]);
  const [currentCollections, setCurrentCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load collections when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCollections();
    }
  }, [isOpen]);

  // Update current view when path changes
  useEffect(() => {
    if (collections.length > 0) {
      if (currentPath.length === 0) {
        // Show root collections
        setCurrentCollections(collections);
      } else {
        // Show children of current collection
        const currentCollection = currentPath[currentPath.length - 1];
        setCurrentCollections(currentCollection.children);
      }
    }
  }, [collections, currentPath]);

  const loadCollections = async () => {
    // Use cached collections if available
    if (collectionsCache) {
      setCollections(collectionsCache);
      setCurrentPath([]);
      setSelectedCollection(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/intercom/collections');
      if (response.ok) {
        const data = await response.json();
        const fetchedCollections = data.collections || [];
        
        if (fetchedCollections.length === 0) {
          setError('No collections found. Please create collections in Intercom first.');
        } else {
          collectionsCache = fetchedCollections; // Cache for session
          setCollections(fetchedCollections);
          setCurrentPath([]);
          setSelectedCollection(null);
        }
      } else {
        setError('Failed to load collections. Please try again.');
        toast.error('Failed to load collections');
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
      setError('Network error. Please check your connection.');
      toast.error('Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToCollection = (collection: Collection) => {
    if (collection.children && collection.children.length > 0) {
      setCurrentPath([...currentPath, collection]);
      setSelectedCollection(null);
    } else {
      // This is a leaf collection, select it
      setSelectedCollection(collection);
    }
  };

  const navigateBack = () => {
    if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
      setSelectedCollection(null);
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
    setSelectedCollection(null);
  };

  const handleSelect = () => {
    if (selectedCollection) {
      onSelect(selectedCollection, currentPath);
      onClose();
    } else if (currentPath.length > 0) {
      // Select the current collection we're inside
      const currentCollection = currentPath[currentPath.length - 1];
      onSelect(currentCollection, currentPath.slice(0, -1));
      onClose();
    }
  };

  const canSelect = selectedCollection || currentPath.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[600px] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Collection placement</DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="size-6 p-0"
          >
            <X className="size-4" />
          </Button>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading collections...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        ) : (
          <>
            {/* Breadcrumbs */}
            {currentPath.length > 0 && (
              <div className="flex items-center gap-1 py-2 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={navigateBack}
                  className="p-1"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="flex items-center gap-1 flex-1 overflow-hidden">
                  <button
                    onClick={() => setCurrentPath([])}
                    className="text-sm text-muted-foreground hover:text-foreground truncate"
                  >
                    Collections
                  </button>
                  {currentPath.map((collection, index) => (
                    <div key={collection.id} className="flex items-center gap-1">
                      <ChevronRight className="size-3 text-muted-foreground" />
                      <button
                        onClick={() => navigateToBreadcrumb(index)}
                        className="text-sm text-muted-foreground hover:text-foreground truncate"
                      >
                        {collection.name}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collections List */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-1 p-1">
                {currentCollections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => navigateToCollection(collection)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent text-left transition-colors ${
                      selectedCollection?.id === collection.id
                        ? 'bg-accent border-primary'
                        : 'border-border'
                    }`}
                  >
                    <Folder className="size-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{collection.name}</p>
                      {collection.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {collection.description}
                        </p>
                      )}
                    </div>
                    {collection.children && collection.children.length > 0 && (
                      <ChevronRight className="size-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSelect}
                disabled={!canSelect}
              >
                Select
                {selectedCollection 
                  ? ` "${selectedCollection.name}"`
                  : currentPath.length > 0 
                    ? ` "${currentPath[currentPath.length - 1].name}"`
                    : ''
                }
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}