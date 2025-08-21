'use client';

import type { Attachment } from '@/lib/types';
import { X } from 'lucide-react';
import { NotionIcon } from './notion-slack-icons';

interface FileAttachmentProps {
  attachment: Attachment;
  isUploading?: boolean;
  uploadProgress?: number;
  onRemove?: () => void;
}

// Animal-inspired colors for each file type
const fileTypeConfig = {
  pdf: {
    abbreviation: 'PDF',
    color: 'bg-red-500', // Cardinal red - like a cardinal bird
    textColor: 'text-white',
    progressColor: '#ef4444',
  },
  csv: {
    abbreviation: 'CSV',
    color: 'bg-green-500', // Frog green - spreadsheets hop between cells
    textColor: 'text-white',
    progressColor: '#10b981',
  },
  json: {
    abbreviation: 'JSON',
    color: 'bg-purple-500', // Octopus purple - complex structures
    textColor: 'text-white',
    progressColor: '#a855f7',
  },
  txt: {
    abbreviation: 'TXT',
    color: 'bg-gray-500', // Elephant gray - simple and reliable
    textColor: 'text-white',
    progressColor: '#6b7280',
  },
  md: {
    abbreviation: 'MD',
    color: 'bg-blue-500', // Dolphin blue - smart and elegant
    textColor: 'text-white',
    progressColor: '#3b82f6',
  },
  svg: {
    abbreviation: 'SVG',
    color: 'bg-orange-500', // Tiger orange - bold graphics
    textColor: 'text-white',
    progressColor: '#f97316',
  },
  notion: {
    abbreviation: 'NOT',
    color: 'bg-black',
    textColor: 'text-white',
    progressColor: '#000000',
  },
  default: {
    abbreviation: 'FILE',
    color: 'bg-zinc-500',
    textColor: 'text-white',
    progressColor: '#71717a',
  },
} as const;

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function truncateFileName(filename: string, maxLength = 15): string {
  const extension = getFileExtension(filename);
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
  
  if (nameWithoutExt.length <= maxLength) {
    return filename;
  }
  
  const truncated = `${nameWithoutExt.substring(0, maxLength - 3)}...`;
  return `${truncated}.${extension}`;
}

function getFileTypeFromMimeType(mimeType: string): string {
  const mimeToType: Record<string, string> = {
    'application/pdf': 'pdf',
    'text/csv': 'csv',
    'application/json': 'json',
    'text/plain': 'txt',
    'text/markdown': 'md',
    'image/svg+xml': 'svg',
    'application/notion': 'notion',
  };
  
  return mimeToType[mimeType] || 'default';
}

function getFileTypeFromExtension(filename: string): string {
  const extension = getFileExtension(filename);
  const extToType: Record<string, string> = {
    'pdf': 'pdf',
    'csv': 'csv', 
    'json': 'json',
    'txt': 'txt',
    'md': 'md',
    'markdown': 'md',
    'svg': 'svg',
  };
  
  return extToType[extension] || 'default';
}

export function FileAttachment({ 
  attachment, 
  isUploading = false, 
  uploadProgress = 0,
  onRemove 
}: FileAttachmentProps) {
  const { name, contentType, type } = attachment;
  
  // Check if this is a Notion document first
  if (type === 'notion') {
    const config = fileTypeConfig.notion;
    const displayName = truncateFileName(name || 'Notion Doc');
    
    return (
      <div className="relative group">
        <div className="border border-border/30 rounded-lg">
          <div className="h-16 max-w-[200px] min-w-[120px] bg-muted rounded-lg flex items-center gap-3 px-3 py-2">
            {/* Notion Icon */}
            <div className="relative shrink-0">
              <div className={`size-8 rounded flex items-center justify-center ${config.color} ${config.textColor}`}>
                <NotionIcon size={14} />
              </div>
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate" title={name}>
                {displayName}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase">
                NOTION
              </div>
            </div>

            {/* Remove button */}
            {onRemove && (
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
      </div>
    );
  }
  
  // Try to detect file type from MIME type first, then fallback to extension
  let fileType = contentType ? getFileTypeFromMimeType(contentType) : 'default';
  if (fileType === 'default' && name) {
    fileType = getFileTypeFromExtension(name);
  }
  
  const config = fileTypeConfig[fileType as keyof typeof fileTypeConfig] || fileTypeConfig.default;
  const extension = getFileExtension(name || 'file');
  const displayName = truncateFileName(name || 'file');

  return (
    <div className="relative group">
      <div className="border border-border/30 rounded-lg">
        <div className="h-16 max-w-[200px] min-w-[120px] bg-muted rounded-lg flex items-center gap-3 px-3 py-2">
        {/* Icon / Progress */}
        <div className="relative shrink-0">
          {isUploading ? (
            <>
              {/* Progress circle */}
              <svg className="size-8 -rotate-90">
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="text-muted-foreground/20"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke={config.progressColor}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 14}`}
                  strokeDashoffset={`${2 * Math.PI * 14 * (1 - uploadProgress / 100)}`}
                  className="transition-all duration-300"
                />
              </svg>
              {/* Loading text in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
            </>
          ) : (
            <div className={`size-8 rounded flex items-center justify-center ${config.color} ${config.textColor}`}>
              <span className="text-xs font-bold">{config.abbreviation}</span>
            </div>
          )}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-foreground truncate" title={name}>
            {displayName}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase">
            {extension}
          </div>
        </div>

        {/* Remove button */}
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
    </div>
  );
}