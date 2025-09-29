'use client';

import { useState, useRef } from 'react';
import { Button, Box, Typography, CircularProgress } from '@mui/material';
import { DocumentUpload, CloseCircle, Image as ImageIcon } from '@wandersonalwes/iconsax-react';
import { openSnackbar } from '@/api/snackbar';
import api from '@/utils/axios';

interface FileUploadProps {
  onUploadComplete: (imageUrl: string) => void;
  currentImageUrl?: string;
  workspaceId: string;
  uploadType: 'branding' | 'landing';
  accept?: string;
  maxSize?: number; // in MB
  className?: string;
}

export default function FileUpload({
  onUploadComplete,
  currentImageUrl,
  workspaceId,
  uploadType,
  accept = "image/*",
  maxSize = 5,
  className = ""
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      openSnackbar({
        open: true,
        message: 'Please select an image file',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      openSnackbar({
        open: true,
        message: `File size must be less than ${maxSize}MB`,
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('workspaceId', workspaceId);

      // Upload file
      const response = await api.post(`/api/upload/${uploadType}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const imageUrl = response.data.imageUrl;
        setPreviewUrl(imageUrl);
        onUploadComplete(imageUrl);
        openSnackbar({
          open: true,
          message: 'Image uploaded successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to upload image',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    onUploadComplete('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {previewUrl ? (
        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: 128,
              bgcolor: 'grey.100',
              borderRadius: 1,
              overflow: 'hidden',
              '&:hover .upload-overlay': {
                opacity: 1
              }
            }}
          >
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <Box
              className="upload-overlay"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                opacity: 0,
                transition: 'opacity 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              }}
            >
              <Button
                size="small"
                variant="contained"
                onClick={handleButtonClick}
                disabled={isUploading}
                startIcon={isUploading ? <CircularProgress size={16} /> : <DocumentUpload size={16} />}
              >
                Replace
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={handleRemoveImage}
                disabled={isUploading}
                startIcon={<CloseCircle size={16} />}
              >
                Remove
              </Button>
            </Box>
          </Box>
        </Box>
      ) : (
        <Box
          onClick={handleButtonClick}
          sx={{
            width: '100%',
            height: 128,
            border: '2px dashed',
            borderColor: 'grey.300',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
            '&:hover': {
              borderColor: 'grey.400'
            }
          }}
        >
          {isUploading ? (
            <CircularProgress size={32} />
          ) : (
            <>
              <ImageIcon size={32} style={{ color: '#666', marginBottom: 8 }} />
              <Typography variant="body2" color="text.secondary">
                Click to upload image
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PNG, JPG, or SVG (max {maxSize}MB)
              </Typography>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
