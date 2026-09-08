import React, { useState } from 'react';

const AudioUploader: React.FC = () => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [cloudName, setCloudName] = useState<string>('j5on4xwq');
  const [uploadPreset, setUploadPreset] = useState<string>('multilingo_audio');
  const [message, setMessage] = useState<string>('');

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!cloudName || !uploadPreset) {
      setMessage('Lỗi: Vui lòng nhập Cloud Name và Upload Preset.');
      return;
    }

    if (!file.type.startsWith('audio/')) {
      setMessage('Vui lòng chỉ chọn file âm thanh (mp3, wav...)');
      return;
    }

    setIsUploading(true);
    setMessage('Đang tải file lên Cloudinary...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('resource_type', 'video'); // Cloudinary dùng video cho cả audio

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (data.secure_url) {
        setAudioUrl(data.secure_url);
        setMessage('Upload lên Cloudinary thành công!');
      } else {
        setMessage(`Lỗi Cloudinary: ${data.error?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      setMessage('Có lỗi xảy ra khi upload: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!audioUrl) return;

    setMessage('Đang lưu vào Spring Boot Database...');

    const payload = {
      sectionId: 'test-section-01',
      partNumber: 1,
      contentData: {
        instruction: "Listen to the recording and answer.",
        shared_media: {
          type: "audio",
          url: audioUrl
        },
        questions: []
      }
    };

    try {
      const response = await fetch('http://localhost:8080/api/test/upload-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Lưu DB thành công! ID: ${data.saved_id}`);
        console.log("DB Response:", data);
      } else {
        setMessage(`Lỗi lưu DB: ${data.message || response.statusText}`);
      }
    } catch (error: any) {
      setMessage('Lỗi khi gọi Spring Boot API: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>🎙️ Test Audio Upload (React - Cloudinary - Spring Boot)</h2>

      <div style={{ marginBottom: '15px' }}>
        <label>Cloud Name:</label>
        <input
          type="text"
          value={cloudName}
          onChange={(e) => setCloudName(e.target.value)}
          placeholder="Ví dụ: dxabc123"
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>Upload Preset:</label>
        <input
          type="text"
          value={uploadPreset}
          onChange={(e) => setUploadPreset(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <input
          type="file"
          accept="audio/*"
          onChange={handleAudioUpload}
          disabled={isUploading}
        />
      </div>

      {message && (
        <p style={{ color: message.includes('Lỗi') ? 'red' : 'green', fontWeight: 'bold' }}>
          {message}
        </p>
      )}

      {audioUrl && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
          <p><strong>URL đã lấy được từ Cloudinary:</strong></p>
          <input
            type="text"
            readOnly
            value={audioUrl}
            style={{ width: '100%', padding: '8px', backgroundColor: '#eef', marginBottom: '15px' }}
          />

          <audio controls src={audioUrl} style={{ width: '100%', marginBottom: '15px' }}></audio>

          <button
            onClick={handleSaveToDatabase}
            style={{ width: '100%', padding: '10px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Lưu vào Database (JSONB)
          </button>
        </div>
      )}
    </div>
  );
};

export default AudioUploader;
