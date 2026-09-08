import React, { useEffect, useState } from 'react';

const StudentExamView: React.FC = () => {
  const [examData, setExamData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Fetch dữ liệu đề thi mới nhất từ Spring Boot
    const fetchExamData = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/test/latest-part');
        if (!response.ok) {
          throw new Error('Không tìm thấy dữ liệu đề thi nào. Bạn đã upload từ phía Admin chưa?');
        }
        const data = await response.json();
        setExamData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExamData();
  }, []);

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải đề thi...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>{error}</div>;
  if (!examData) return <div style={{ padding: '20px', textAlign: 'center' }}>Không có dữ liệu.</div>;

  const contentData = examData.contentData;
  const audioUrl = contentData?.shared_media?.url;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
      <h2 style={{ color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>
        🎧 Giao diện Làm bài (Student View)
      </h2>
      
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        {/* Cột trái: Nội dung Audio & Đề bài */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>Phần thi: Listening Part {examData.partNumber}</h3>
          
          <div style={{ backgroundColor: '#e8f4fd', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>{contentData?.instruction || 'Listen to the audio and answer the questions.'}</p>
            {audioUrl ? (
              <audio controls style={{ width: '100%' }}>
                <source src={audioUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            ) : (
              <p style={{ color: 'red' }}>Lỗi: Không tìm thấy file Audio trong dữ liệu trả về.</p>
            )}
          </div>

          <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: '8px' }}>
            <p style={{ fontWeight: 'bold' }}>Q1: What is the main topic of the conversation?</p>
            <div>
              <label style={{ display: 'block', margin: '10px 0' }}><input type="radio" name="q1" /> A. School project</label>
              <label style={{ display: 'block', margin: '10px 0' }}><input type="radio" name="q1" /> B. Weekend plans</label>
              <label style={{ display: 'block', margin: '10px 0' }}><input type="radio" name="q1" /> C. Weather forecast</label>
              <label style={{ display: 'block', margin: '10px 0' }}><input type="radio" name="q1" /> D. Sports event</label>
            </div>
          </div>
        </div>

        {/* Cột phải: JSON Raw Data (Để Admin kiểm tra) */}
        <div style={{ flex: 1, backgroundColor: '#2d3436', color: '#dfe6e9', padding: '15px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#74b9ff' }}>Dữ liệu JSONB gốc:</h4>
          <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            {JSON.stringify(examData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default StudentExamView;
