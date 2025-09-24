'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, Loader2 } from 'lucide-react';
import { IntercomIcon } from '@/components/icons/intercom';
import { CollectionSelectorModal } from '@/components/collection-selector-modal';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

interface IntercomAdmin {
  id: string;
  name: string;
  email: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  parent_id: string | null;
  children: Collection[];
}

interface IntercomUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

// Session cache for admins
let adminsCache: IntercomAdmin[] | null = null;

// Helpers for SEO-friendly, <100 words description
function cleanMarkdownToText(input: string): string {
  const safe = (input || '').toString();
  let text = safe.replace(/```[\s\S]*?```/g, ' '); // code blocks
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' '); // images
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // links
  text = text.replace(/[#>*_`~]/g, ' '); // md symbols
  text = text.replace(/\s+/g, ' ').trim(); // whitespace
  return text;
}

function getFocusPhrase(title: string): string {
  const base = (title || '').trim();
  const cleaned = base.replace(/[\p{P}\p{S}]+/gu, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);
  const stop = new Set([
    'the','a','an','and','or','for','of','to','in','on','with','by','from','as','at','is','are','be','your','you','how','what','why','when','guide'
  ]);
  const focus = words.filter(w => !stop.has(w.toLowerCase()) && w.length > 2).slice(0, 8);
  const phrase = (focus.length ? focus.join(' ') : words.slice(0, 8).join(' ')).trim();
  return phrase;
}

function limitChars(text: string, maxChars: number): string {
  const t = (text || '').trim();
  if (t.length <= maxChars) return t;
  const sliced = t.slice(0, maxChars).trim();
  // Try not to cut a word too awkwardly
  const lastSpace = sliced.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.6) return sliced.slice(0, lastSpace);
  return sliced;
}

// Generate a concise, SEO-leaning description (< 100 words)
function generateDefaultDescription(title: string, content: string): string {
  const focus = getFocusPhrase(title);
  const text = cleanMarkdownToText(content);

  // Try first meaningful sentences
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let candidate = sentences[0] || text || title || '';

  // If too short or generic, try adding second sentence
  if (candidate.split(/\s+/).length < 8 && sentences[1]) {
    candidate = `${candidate} ${sentences[1]}`.trim();
  }

  // Ensure focus phrase appears early for SEO
  const hasFocus = focus && candidate.toLowerCase().includes(focus.toLowerCase());
  let result = hasFocus ? candidate : `${focus ? focus + ': ' : ''}${candidate}`.trim();

  // Use active-voice cues when missing verbs (simple heuristic)
  if (!/[a-zA-Z]+\s+(to|for|lets|helps|learn|set|create|manage|troubleshoot|optimize)/i.test(result)) {
    result = result.replace(/^([A-Za-z].*?)$/u, (m) => `Learn about ${m}`);
  }

  // Keep under 255 characters
  result = limitChars(result, 255);

  return result.trim();
}

export function IntercomUploadDialog({
  isOpen,
  onClose,
  title,
  content,
}: IntercomUploadDialogProps) {
  const [articleType, setArticleType] = useState<'helpcenter' | 'internal' | ''>('');
  const [articleTitle, setArticleTitle] = useState(title);
  const [selectedAuthor, setSelectedAuthor] = useState<string>('');
  const [admins, setAdmins] = useState<IntercomAdmin[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [adminsFetchError, setAdminsFetchError] = useState<string | null>(null);
  
  // Help center specific fields
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [collectionPath, setCollectionPath] = useState<Collection[]>([]);
  const [articleDescription, setArticleDescription] = useState('');
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [hasPrefilledDescription, setHasPrefilledDescription] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setArticleType('');
      setArticleTitle(title);
      setSelectedAuthor('');
      setAdmins([]);
      setSelectedCollection(null);
      setCollectionPath([]);
      setArticleDescription('');
      setHasPrefilledDescription(false);
    }
  }, [isOpen, title]);

  // Load admins when Internal or Help Center article is selected
  useEffect(() => {
    if (articleType === 'internal' || articleType === 'helpcenter') {
      loadAdmins();
    }
  }, [articleType]);

  // Prefill description for Help Center once when field becomes relevant
  useEffect(() => {
    if (
      articleType === 'helpcenter' &&
      !hasPrefilledDescription &&
      articleDescription.trim() === ''
    ) {
      const generated = generateDefaultDescription(articleTitle, content);
      if (generated) {
        setArticleDescription(generated);
        setHasPrefilledDescription(true);
      }
    }
  }, [articleType, hasPrefilledDescription, articleDescription, articleTitle, content]);

  const loadAdmins = async () => {
    // Use cached admins if available
    if (adminsCache) {
      setAdmins(adminsCache);
      return;
    }

    setIsLoadingAdmins(true);
    setAdminsFetchError(null);
    try {
      const response = await fetch('/api/intercom/admins');
      if (response.ok) {
        const data = await response.json();
        const fetchedAdmins = data.admins || [];
        
        if (fetchedAdmins.length === 0) {
          setAdminsFetchError('No admins found. Please check your Intercom configuration.');
        } else {
          adminsCache = fetchedAdmins; // Cache for session
          setAdmins(fetchedAdmins);
        }
      } else {
        setAdminsFetchError('Failed to load authors. Please try again.');
        toast.error('Failed to load authors');
      }
    } catch (error) {
      console.error('Failed to load admins:', error);
      setAdminsFetchError('Network error. Please check your connection.');
      toast.error('Failed to load authors');
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  const handleSubmit = async () => {
    if (!articleType) {
      toast.error('Please select an article type');
      return;
    }

    if (!articleTitle.trim()) {
      toast.error('Title cannot be empty');
      return;
    }

    if ((articleType === 'internal' || articleType === 'helpcenter') && !selectedAuthor) {
      toast.error('Please select an author');
      return;
    }

    if (articleType === 'helpcenter' && !selectedCollection) {
      toast.error('Please select a collection');
      return;
    }

    setIsUploading(true);

    try {
      const endpoint = articleType === 'internal' 
        ? '/api/intercom/articles/internal' 
        : '/api/intercom/articles/helpcenter';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: articleTitle,
          content,
          ...(articleType === 'internal' && { 
            authorId: selectedAuthor
          }),
          ...(articleType === 'helpcenter' && {
            authorId: selectedAuthor,
            collectionId: selectedCollection?.id,
            description: articleDescription.trim() || undefined
          }),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(`Article created successfully in ${articleType === 'internal' ? 'Internal Knowledge Base' : 'Help Center'}`);
        if (result.url) {
          window.open(result.url, '_blank');
        }
        onClose();
      } else {
        toast.error(`Failed to create article: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload article');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <IntercomIcon size={20} />
            Intercom
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="size-6 p-0"
          >
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="article-type">Article Type</Label>
            <Select value={articleType} onValueChange={(value: 'helpcenter' | 'internal') => setArticleType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select article type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="helpcenter">Help Center</SelectItem>
                <SelectItem value="internal">Internal Article</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {articleType && (
            <>
              <div className="space-y-2">
                <Label htmlFor="article-title">Title</Label>
                <Input
                  id="article-title"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  placeholder="Enter article title"
                />
              </div>

              {articleType === 'internal' && (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-sm text-amber-800">
                      ℹ️ Internal articles will be created at the root level. You&apos;ll need to manually move them to your desired folder in Intercom.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="author-select">Author</Label>
                  {isLoadingAdmins ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading authors...</span>
                    </div>
                  ) : adminsFetchError ? (
                    <div className="text-sm text-destructive">
                      {adminsFetchError}
                    </div>
                  ) : (
                    <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select author" />
                      </SelectTrigger>
                      <SelectContent>
                        {admins.map((admin) => (
                          <SelectItem key={admin.id} value={admin.id}>
                            {admin.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  </div>
                </>
              )}

              {articleType === 'helpcenter' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="collection-select">Collection</Label>
                    <Button
                      variant="outline"
                      onClick={() => setIsCollectionModalOpen(true)}
                      className="w-full justify-start h-auto p-3"
                    >
                      {selectedCollection ? (
                        <div className="text-left">
                          <p className="font-medium">{selectedCollection.name}</p>
                          {collectionPath.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              {collectionPath.map(c => c.name).join(' > ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select collection...</span>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="article-description">Description (optional)</Label>
                    <Textarea
                      id="article-description"
                      value={articleDescription}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length <= 255) {
                          setArticleDescription(value);
                        } else {
                          setArticleDescription(value.slice(0, 255));
                        }
                      }}
                      placeholder="SEO-friendly summary (up to 255 characters)..."
                      className="min-h-[80px] resize-none"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {articleDescription.length}/255 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="helpcenter-author-select">Author</Label>
                    {isLoadingAdmins ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="size-4 animate-spin" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading authors...</span>
                      </div>
                    ) : adminsFetchError ? (
                      <div className="text-sm text-destructive">
                        {adminsFetchError}
                      </div>
                    ) : (
                      <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select author" />
                        </SelectTrigger>
                        <SelectContent>
                          {admins.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </>
              )}

              <Button 
                onClick={handleSubmit} 
                disabled={isUploading || !articleTitle.trim() || 
                  (articleType === 'internal' && (!selectedAuthor || adminsFetchError !== null)) ||
                  (articleType === 'helpcenter' && (!selectedAuthor || !selectedCollection || adminsFetchError !== null))}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating Article...
                  </>
                ) : (
                  `Create ${articleType === 'internal' ? 'Internal Article' : 'Help Center Article'}`
                )}
              </Button>
            </>
          )}
        </div>

        <CollectionSelectorModal
          isOpen={isCollectionModalOpen}
          onClose={() => setIsCollectionModalOpen(false)}
          onSelect={(collection, path) => {
            setSelectedCollection(collection);
            setCollectionPath(path);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
