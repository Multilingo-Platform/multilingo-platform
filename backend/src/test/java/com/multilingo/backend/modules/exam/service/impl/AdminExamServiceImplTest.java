package com.multilingo.backend.modules.exam.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.PartBuilderRequest;
import com.multilingo.backend.modules.exam.dto.request.SectionBuilderRequest;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminExamServiceImplTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamSectionRepository sectionRepository;

    @Mock
    private ExamPartRepository partRepository;

    @InjectMocks
    private AdminExamServiceImpl examService;

    private ExamBuilderRequest request;

    @BeforeEach
    void setUp() {
        request = ExamBuilderRequest.builder()
                .title("Mock Exam")
                .type("IELTS")
                .examLanguage("en")
                .isPublished(true)
                .sections(List.of(
                        SectionBuilderRequest.builder()
                                .skillType("LISTENING")
                                .durationMinutes(40)
                                .parts(List.of(
                                        PartBuilderRequest.builder()
                                                .partNumber(1)
                                                .contentData(Map.of("hello", "world"))
                                                .build()
                                ))
                                .build()
                ))
                .build();
    }

    @Test
    void createExam_Success() {
        Exam savedExam = new Exam();
        savedExam.setId(1);
        when(examRepository.save(any(Exam.class))).thenReturn(savedExam);

        ExamSection savedSection = new ExamSection();
        savedSection.setId(10);
        when(sectionRepository.save(any(ExamSection.class))).thenReturn(savedSection);

        Integer resultId = examService.createExam(request);

        assertThat(resultId).isEqualTo(1);
        verify(examRepository, times(1)).save(any(Exam.class));
        verify(sectionRepository, times(1)).save(any(ExamSection.class));
        verify(partRepository, times(1)).save(any());
    }

    @Test
    void updateExam_NotFound() {
        when(examRepository.findById(99)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> examService.updateExam(99, request))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Không tìm thấy đề thi yêu cầu");
    }

    @Test
    void updateExam_Success() {
        Exam existingExam = new Exam();
        existingExam.setId(1);
        
        ExamSection existingSection = new ExamSection();
        existingSection.setId(10);
        when(examRepository.findById(1)).thenReturn(Optional.of(existingExam));
        when(sectionRepository.findByExam_Id(1)).thenReturn(List.of(existingSection));
        when(sectionRepository.save(any(ExamSection.class))).thenReturn(existingSection);

        examService.updateExam(1, request);

        verify(partRepository, times(1)).deleteBySection_IdIn(List.of(10));
        verify(sectionRepository, times(1)).deleteByExam_Id(1);
        
        verify(examRepository, times(1)).save(existingExam);
        verify(sectionRepository, times(1)).save(any(ExamSection.class));
        verify(partRepository, times(1)).save(any());
    }
}
