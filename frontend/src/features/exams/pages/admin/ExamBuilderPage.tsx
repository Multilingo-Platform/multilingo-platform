import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ExamBuilder from './ExamBuilder';
import axiosClient from '../../../../core/api/axiosClient';
import Swal from 'sweetalert2';

const ExamBuilderPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (id) {
      axiosClient.get<any, any>(`/v1/admin/exams/${id}`)
        .then((res: any) => {
          if (res.success) {
            setInitialData(res.data);
          }
        })
        .catch(err => {
          console.error(err);
          Swal.fire('Lỗi tải đề thi', err.message, 'error');
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleSave = async (jsonStruct: string) => {
    try {
      const data = JSON.parse(jsonStruct);
      
      if (!data.exam_title) {
        Swal.fire('Thiếu thông tin', 'Vui lòng nhập Tên đề thi ở phần thông tin cơ bản!', 'warning');
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
        published: data.is_published !== false,
        isPublished: data.is_published !== false, // sending both just in case
        sections: Object.values(sectionsMap)
      };

      console.log("Sending Payload:", payload);
      if (id) {
        await axiosClient.put(`/v1/admin/exams/${id}`, payload);
      } else {
        await axiosClient.post('/v1/admin/exams', payload);
      }
      Swal.fire({ title: 'Thành công!', text: 'Đã lưu đề thi thành công', icon: 'success', timer: 1500, showConfirmButton: false });
      navigate('/admin/exams');
    } catch (error: any) {
      console.error(error);
      Swal.fire('Lỗi khi lưu đề thi', error.response?.data?.message || error.message, 'error');
    }
  };

  const handleCancel = () => {
    navigate('/admin/exams');
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Đang tải dữ liệu đề thi...</div>;
  }

  return (
    <div className="slide-up">
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{id ? 'Chỉnh sửa Đề thi' : 'Tạo Đề thi Mới'}</h1>
        <button className="btn btn-outline" onClick={handleCancel}>
          Trở về Danh sách
        </button>
      </div>

      <ExamBuilder initialData={initialData} onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
};

export default ExamBuilderPage;
