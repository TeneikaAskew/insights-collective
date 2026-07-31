
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, File, Image, Video, X } from 'lucide-react';
import { useFileUpload, UploadedFile } from '@/hooks/useFileUpload';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  onFileUploaded: (file: UploadedFile) => void;
  /** Course the upload belongs to — becomes the first path segment the bucket policies key off. */
  courseId: string;
  /**
   * When set, the file is uploaded as this user's assignment submission
   * (path submissions/<courseId>/<userId>/...), which the course_submission_*
   * policies authorize for an enrolled student. Omit for course-material uploads,
   * which require course-staff permission.
   */
  submissionUserId?: string;
  acceptedTypes?: 'images' | 'videos' | 'documents' | 'all';
  maxSize?: number;
  className?: string;
}

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFileUploaded,
  courseId,
  submissionUserId,
  acceptedTypes = 'all',
  maxSize = 50 * 1024 * 1024, // 50MB default
  className
}) => {
  const { uploadFile, uploading, progress } = useFileUpload();
  const [dragActive, setDragActive] = useState(false);

  const getAcceptedFileTypes = () => {
    switch (acceptedTypes) {
      case 'images':
        return { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] };
      case 'videos':
        return { 'video/*': ['.mp4', '.mov', '.avi', '.webm'] };
      case 'documents':
        return { 
          'application/pdf': ['.pdf'],
          'application/msword': ['.doc'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
          'application/vnd.ms-powerpoint': ['.ppt'],
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
        };
      default:
        return {
          'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
          'video/*': ['.mp4', '.mov', '.avi', '.webm'],
          'application/pdf': ['.pdf'],
          'application/msword': ['.doc'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        };
    }
  };

  const getBucket = (fileType: string): 'course-images' | 'course-videos' | 'course-documents' => {
    if (fileType.startsWith('image/')) return 'course-images';
    if (fileType.startsWith('video/')) return 'course-videos';
    return 'course-documents';
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const bucket = getBucket(file.type);
    const uploadedFile = await uploadFile(file, bucket, courseId, { submissionUserId });

    if (uploadedFile) {
      onFileUploaded(uploadedFile);
    }
  }, [uploadFile, onFileUploaded, courseId, submissionUserId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptedFileTypes(),
    maxSize,
    multiple: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const getIcon = () => {
    switch (acceptedTypes) {
      case 'images':
        return <Image className="h-8 w-8" />;
      case 'videos':
        return <Video className="h-8 w-8" />;
      case 'documents':
        return <File className="h-8 w-8" />;
      default:
        return <Upload className="h-8 w-8" />;
    }
  };

  const getDescription = () => {
    switch (acceptedTypes) {
      case 'images':
        return 'Upload images (JPG, PNG, GIF, WebP)';
      case 'videos':
        return 'Upload videos (MP4, MOV, AVI, WebM)';
      case 'documents':
        return 'Upload documents (PDF, DOC, DOCX, PPT, PPTX)';
      default:
        return 'Upload images, videos, or documents';
    }
  };

  if (uploading) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
        <div className="space-y-4">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground animate-pulse" />
          <div>
            <p className="text-sm text-muted-foreground">Uploading...</p>
            <Progress value={progress} className="mt-2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
        isDragActive || dragActive
          ? "border-ss-teal bg-ss-teal-chip"
          : "border-border hover:border-border",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="space-y-4">
        <div className="mx-auto text-muted-foreground">
          {getIcon()}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {isDragActive ? 'Drop the file here' : 'Click to upload or drag and drop'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {getDescription()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Max size: {Math.round(maxSize / (1024 * 1024))}MB
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileUploadZone;
