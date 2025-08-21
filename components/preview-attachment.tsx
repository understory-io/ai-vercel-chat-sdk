import type { Attachment } from '@/lib/types';
import { LoaderIcon } from './icons';
import { X } from 'lucide-react';
import { FileAttachment } from './file-attachment';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  uploadProgress = 0,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  uploadProgress?: number;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;

  // Use FileAttachment component for non-image files
  if (contentType && !contentType.startsWith('image')) {
    return (
      <FileAttachment
        attachment={attachment}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onRemove={onRemove}
      />
    );
  }

  // Keep existing image preview for images
  return (
    <div data-testid="input-attachment-preview" className="relative">
      <div className="size-20 bg-muted rounded-lg relative flex items-center justify-center group">
        {contentType ? (
          contentType.startsWith('image') ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={name ?? 'An image attachment'}
              className="rounded-lg size-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center size-full bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground font-mono uppercase">
                {contentType.split('/')[1] || 'FILE'}
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center size-full bg-muted rounded-lg">
            <div className="text-xs text-muted-foreground font-mono">FILE</div>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
            <div
              data-testid="input-attachment-loader"
              className="animate-spin text-white"
            >
              <LoaderIcon />
            </div>
          </div>
        )}

        {!isUploading && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-1 -right-1 bg-gray-800 hover:bg-gray-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
};
