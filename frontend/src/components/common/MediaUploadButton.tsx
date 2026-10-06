import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';

interface MediaUploadButtonProps {
  onUploadSuccess: (url: string) => void;
  type: 'audio' | 'images';
  label?: string;
}

const MediaUploadButton: React.FC<MediaUploadButtonProps> = ({ onUploadSuccess, type, label }) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hardcoded for demo/platform, in real app move to .env
  const cloudName = 'j5on4xwq';
  const uploadPreset = type === 'audio' ? 'multilingo_audio' : 'multilingo_images';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'audio' && !file.type.startsWith('audio/')) {
      alert('Vui lòng chọn file âm thanh!');
      return;
    }
    if (type === 'images' && !file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh!');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    // For audio on Cloudinary, it is often uploaded as 'video' or 'auto'
    const resourceType = type === 'audio' ? 'video' : 'image';
    formData.append('resource_type', resourceType);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        onUploadSuccess(data.secure_url);
      } else {
        alert('Lỗi upload: ' + (data.error?.message || 'Unknown'));
      }
    } catch (err: any) {
      alert('Upload thất bại: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        type="file"
        accept={type === 'audio' ? 'audio/*' : 'images/*'}
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="btn flex-center"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        style={{
          padding: '0.4rem 0.75rem',
          fontSize: '0.75rem',
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-sm)',
          gap: '0.35rem',
          cursor: isUploading ? 'not-allowed' : 'pointer'
        }}
        title="Tải lên Cloudinary"
      >
        {isUploading ? <Loader2 size={14} className="spin" /> : <UploadCloud size={14} />}
        {isUploading ? 'Đang tải...' : (label || 'Tải file')}
      </button>
    </>
  );
};

export default MediaUploadButton;
