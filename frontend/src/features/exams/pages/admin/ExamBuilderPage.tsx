import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExamBuilder from './ExamBuilder';
import axiosClient from '../../../../core/api/axiosClient';

const ExamBuilderPage = () => {
  const navigate = useNavigate();

  const handleSave = async (jsonStruct: string) => {
    try {
      const data = JSON.parse(jsonStruct);
      
      if (!data.exam_title) {
        alert('Vui lòng nhập Tên đề thi ở phần thông tin cơ bản!');
        return;
      }
      
      const sectionsMap: Record<string, any> = {};
      
      data.parts.forEach((p: any, index: number) => {
          let skill = "MIXED";
          const lowerTitle = (p.part_title || '').toLowerCase();
          if (lowerTitle.includes('listen') || lowerTitle.includes('nghe')) skill = "LISTENING";
          else if (lowerTitle.includes('read') || lowerTitle.includes('đọc')) skill = "READING";
          else if (lowerTitle.includes('writ') || lowerTitle.includes('viết')) skill = "WRITING";
          else if (lowerTitle.includes('speak') || lowerTitle.includes('nói')) skill = "SPEAKING";
          
          if (!sectionsMap[skill]) {
              sectionsMap[skill] = {
                  skillType: skill,
                  durationMinutes: 60, // Default duration per section
                  parts: []
              };
          }
          
          sectionsMap[skill].parts.push({
              partNumber: index + 1,
              contentData: {
                  part_title: p.part_title,
                  instruction: p.instruction,
                  shared_audio: p.shared_audio,
                  shared_content_html: p.shared_content_html,
                  question_groups: p.question_groups
              }
          });
      });

      const payload = {
        title: data.exam_title,
        type: data.exam_type,
        examLanguage: "ENGLISH", 
        isPublished: true,
        sections: Object.values(sectionsMap)
      };

      console.log("Sending Payload:", payload);
      await axiosClient.post('/v1/admin/exams', payload);
      alert("Đã lưu đề thi thành công!");
      navigate('/admin/exams');
    } catch (error: any) {
      console.error(error);
      alert("Lỗi khi lưu đề thi: " + (error.response?.data?.message || error.message));
    }
  };

  const handleCancel = () => {
    navigate('/admin/exams');
  };

  return (
    <div className="slide-up">
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Tạo Đề thi Mới</h1>
        <button className="btn btn-outline" onClick={handleCancel}>
          Trở về Danh sách
        </button>
      </div>

      <ExamBuilder onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
};

export default ExamBuilderPage;
