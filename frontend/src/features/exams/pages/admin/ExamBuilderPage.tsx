import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ExamBuilder from './ExamBuilder';
import axiosClient from '../../../../core/api/axiosClient';
import Swal from 'sweetalert2';
import { toLanguagePracticeRequest, toOfficialExamRequest } from '../../utils/examContentMapping';

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
          const isToeicLr = ((data.exam_type || '').includes('TOEIC') || (data.exam_type || '').includes('LR')) && !(data.exam_type || '').includes('WRITING');
          const isWritingSkill = (data.exam_type || '').includes('WRITING') || lowerTitle.includes('writ') || lowerTitle.includes('viết');

          if (isWritingSkill) {
            skill = "WRITING";
          } else if (
            lowerTitle.includes('listen') || 
            lowerTitle.includes('nghe') ||
            Boolean(p.shared_audio?.url) ||
            (/part\s*[1-4]\b/i.test(lowerTitle) && (isToeicLr || !lowerTitle.includes('task'))) ||
            lowerTitle.includes('photographs') ||
            lowerTitle.includes('question-response') ||
            lowerTitle.includes('conversations') ||
            lowerTitle.includes('talks')
          ) {
            skill = "LISTENING";
          } else if (
            lowerTitle.includes('read') || 
            lowerTitle.includes('đọc') ||
            (/part\s*[5-7]\b/i.test(lowerTitle) && isToeicLr) ||
            lowerTitle.includes('incomplete sentences') ||
            lowerTitle.includes('text completion') ||
            lowerTitle.includes('reading comprehension')
          ) {
            skill = "READING";
          } else if (lowerTitle.includes('speak') || lowerTitle.includes('nói')) {
            skill = "SPEAKING";
          }
          
          if (!sectionsMap[skill]) {
              let duration = 60;
              if (isToeicLr) {
                if (skill === 'LISTENING') duration = 45;
                else if (skill === 'READING') duration = 75;
              }
              sectionsMap[skill] = {
                  skillType: skill,
                  durationMinutes: duration,
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

      const payload = data.exam_type === 'LANGUAGE_PRACTICE'
        ? toLanguagePracticeRequest(data.exam_title, data.exam_language, data.parts, data.is_published !== false)
        : ['TOEIC_LR', 'TOEIC_WRITING', 'IELTS_ACADEMIC', 'NLTV'].includes(data.exam_type)
          ? toOfficialExamRequest(data.exam_title, data.exam_type, data.parts, data.is_published !== false)
          : {
        title: data.exam_title,
        type: data.exam_type,
        examLanguage: data.exam_language || 'en',
        published: data.is_published !== false,
        isPublished: data.is_published !== false, // sending both just in case
        sections: Object.values(sectionsMap)
          };

      if (id) {
        await axiosClient.put(`/v1/admin/exams/${id}`, payload);
      } else {
        await axiosClient.post('/v1/admin/exams', payload);
      }
      Swal.fire({ title: 'Thành công!', text: 'Đã lưu đề thi thành công', icon: 'success', timer: 1500, showConfirmButton: false });
      navigate('/admin/exams');
    } catch {
      Swal.fire('Lỗi khi lưu đề thi', 'Không thể lưu đề. Hãy kiểm tra nội dung và thử lại.', 'error');
    }
  };

  const handleBackToList = () => {
    Swal.fire({
      title: 'Xác nhận rời khỏi?',
      text: 'Bạn có chắc chắn muốn trở về danh sách? Các nội dung chưa lưu có thể bị mất.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Đồng ý',
      cancelButtonText: 'Ở lại tiếp tục'
    }).then((result) => {
      if (result.isConfirmed) {
        navigate('/admin/exams');
      }
    });
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
        <button className="btn btn-outline" onClick={handleBackToList}>
          Trở về Danh sách
        </button>
      </div>

      <ExamBuilder initialData={initialData} onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
};

export default ExamBuilderPage;
