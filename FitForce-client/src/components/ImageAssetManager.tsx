import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  ImageList,
  ImageListItem,
  ImageListItemBar,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import api from '@/utils/axios';

interface TemplateAsset {
  id: string;
  name: string;
  description: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface ImageAssetManagerProps {
  workspaceId: string;
  onAssetSelect?: (asset: TemplateAsset) => void;
  onAssetInsert?: (asset: TemplateAsset) => void;
  showInsertButton?: boolean;
}

export default function ImageAssetManager({ 
  workspaceId, 
  onAssetSelect, 
  onAssetInsert,
  showInsertButton = false 
}: ImageAssetManagerProps) {
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load assets on component mount
  useEffect(() => {
    if (workspaceId && workspaceId.trim() !== '') {
      loadAssets();
    } else {
      setAssets([]); // Clear assets if no workspaceId
    }
  }, [workspaceId]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/templates/assets', {
        headers: { 'x-workspace-id': workspaceId }
      });
      const assets = response.data?.assets || [];
      setAssets(assets);
    } catch (err) {
      setError('Failed to load assets');
      console.error('Error loading assets:', err);
      setAssets([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (50MB limit)
      const maxSize = 50 * 1024 * 1024; // 50MB in bytes
      if (file.size > maxSize) {
        setError(`File too large. Maximum size is 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
        return;
      }
      
      setSelectedFile(file);
      setAssetName(file.name.split('.')[0]); // Set name from filename
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', assetName);
      formData.append('description', assetDescription);

      const response = await api.post('/api/templates/assets', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-workspace-id': workspaceId
        },
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          const percent = Math.round((evt.loaded * 100) / evt.total);
          setUploadProgress(percent);
        }
      });

      // Add new asset to the list
      setAssets(prev => [response.data.asset, ...prev]);
      
      // Reset form
      setSelectedFile(null);
      setAssetName('');
      setAssetDescription('');
      setPreviewUrl(null);
      setUploadDialogOpen(false);
      setUploadProgress(0);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload asset');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      await api.delete(`/api/templates/assets/${assetId}`);
      setAssets(prev => prev.filter(asset => asset.id !== assetId));
    } catch (err) {
      setError('Failed to delete asset');
      console.error('Error deleting asset:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <Typography variant="h6" component="h2" sx={{ mr: 2, whiteSpace: 'nowrap' }}>
            Image Assets
          </Typography>
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name..."
            size="small"
            sx={{ flex: 1, maxWidth: 420 }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={loadAssets}>Refresh</Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Upload Image
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Assets Grid */}
      {!loading && (
        <ImageList sx={{ width: '100%', height: 400 }} cols={3} rowHeight={200}>
          {assets
            .filter(asset => asset && asset.id && asset.url)
            .filter(asset => !query || asset.name.toLowerCase().includes(query.toLowerCase()))
            .map((asset) => (
            <ImageListItem key={asset.id}>
              <img
                src={asset.url}
                alt={asset.name}
                loading="lazy"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  cursor: 'pointer'
                }}
                onClick={() => onAssetSelect?.(asset)}
              />
              <ImageListItemBar
                title={asset.name}
                subtitle={
                  <Box>
                    <Typography variant="caption" display="block">
                      {formatFileSize(asset.size)}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {formatDate(asset.createdAt)}
                    </Typography>
                  </Box>
                }
                actionIcon={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      sx={{ color: 'white' }}
                      onClick={() => navigator.clipboard.writeText(asset.url)}
                      title="Copy URL"
                    >
                      <CloseIcon style={{ transform: 'rotate(45deg)' }} />
                    </IconButton>
                    {showInsertButton && (
                      <IconButton
                        sx={{ color: 'white' }}
                        onClick={() => onAssetInsert?.(asset)}
                        title="Insert into template"
                      >
                        <ImageIcon />
                      </IconButton>
                    )}
                    <IconButton
                      sx={{ color: 'white' }}
                      onClick={() => handleDelete(asset.id)}
                      title="Delete asset"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              />
            </ImageListItem>
          ))}
        </ImageList>
      )}

      {/* Empty State */}
      {!loading && assets.length === 0 && (
        <Card sx={{ textAlign: 'center', py: 4 }}>
          <CardContent>
            <ImageIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No images uploaded yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Upload images to use in your PDF templates
            </Typography>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Your First Image
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Upload Image Asset
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/* File Upload */}
            <Box sx={{ mb: 3 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                id="file-upload-input"
              />
              <Button
                variant="outlined"
                onClick={() => fileInputRef.current?.click()}
                startIcon={<UploadIcon />}
                fullWidth
                sx={{ py: 2, mb: 2 }}
              >
                Choose Image File
              </Button>
            <Box
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const maxSize = 50 * 1024 * 1024;
                  if (file.size > maxSize) {
                    setError(`File too large. Maximum size is 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`);
                  } else {
                    setSelectedFile(file);
                    setAssetName(file.name.split('.')[0]);
                    const url = URL.createObjectURL(file);
                    setPreviewUrl(url);
                  }
                }
              }}
              sx={{
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                color: 'text.secondary'
              }}
            >
              Drag & drop image here
            </Box>
              {selectedFile && (
                <Typography variant="body2" color="text.secondary">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </Typography>
              )}
            </Box>

            {/* Preview */}
            {previewUrl && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview:
                </Typography>
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{
                    width: '100%',
                    maxHeight: 200,
                    objectFit: 'contain',
                    borderRadius: 8,
                    border: '1px solid #e0e0e0'
                  }}
                />
              </Box>
            )}

            {/* Asset Details */}
            <TextField
              label="Asset Name"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              placeholder="Enter a name for this asset"
            />
            <TextField
              label="Description (Optional)"
              value={assetDescription}
              onChange={(e) => setAssetDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="Describe this image asset"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!selectedFile || !assetName || uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            {uploading ? `Uploading ${uploadProgress}%` : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
