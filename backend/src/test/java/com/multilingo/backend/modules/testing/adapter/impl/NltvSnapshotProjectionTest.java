package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.exam.service.NltvExcelV2ExamParser;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NltvSnapshotProjectionTest {
    @Test
    void projectsVietnamesePartsAndMaskedDictationWithoutLeakingSolutionsToWorkspace() throws Exception {
        byte[] source;
        try (InputStream input = getClass().getResourceAsStream(
                "/datasets/official-source/nltv-sample-test-1.xlsx")) {
            source = input.readAllBytes();
        }
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(source));
        com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest request;
        try (var workbook = WorkbookFactory.create(new ByteArrayInputStream(source))) {
            request = new NltvExcelV2ExamParser().parse(workbook, hash).request();
        }

        Exam exam = Exam.builder().code("NLTV-SAMPLE-T1-V1").title(request.getTitle())
                .type("NLTV").examLanguage("vi").durationMinutes(180).isPublished(true).build();
        exam.setId(80);
        ExamRepository exams = mock(ExamRepository.class);
        ExamSectionRepository sections = mock(ExamSectionRepository.class);
        ExamPartRepository parts = mock(ExamPartRepository.class);
        when(exams.findById(80)).thenReturn(Optional.of(exam));
        List<ExamSection> sectionRows = new ArrayList<>();
        int partId = 800;
        for (int sectionIndex = 0; sectionIndex < request.getSections().size(); sectionIndex++) {
            var sourceSection = request.getSections().get(sectionIndex);
            ExamSection section = ExamSection.builder().exam(exam).skillType(sourceSection.getSkillType())
                    .durationMinutes(sourceSection.getDurationMinutes()).orderIndex(sectionIndex + 1).build();
            section.setId(810 + sectionIndex);
            sectionRows.add(section);
            List<ExamPart> partRows = new ArrayList<>();
            for (var sourcePart : sourceSection.getParts()) {
                ExamPart part = ExamPart.builder().section(section).partNumber(sourcePart.getPartNumber())
                        .contentData(sourcePart.getContentData()).build();
                part.setId(partId++);
                partRows.add(part);
            }
            when(parts.findBySection_Id(section.getId())).thenReturn(partRows);
        }
        when(sections.findByExam_Id(80)).thenReturn(sectionRows);
        var adapter = new DbExamAdapter(exams, sections, parts, new ObjectMapper());

        ExamFixture workspace = adapter.findById(80).orElseThrow();
        ExamFixture reviewSnapshot = adapter.findSnapshotById(80).orElseThrow();
        String workspaceJson = new ObjectMapper().writeValueAsString(workspace);
        String snapshotJson = new ObjectMapper().writeValueAsString(reviewSnapshot);

        assertThat(workspace.getExamLanguage()).isEqualTo("vi");
        assertThat(workspace.getDurationMinutes()).isEqualTo(180);
        assertThat(workspace.getSections()).extracting(section -> section.getName())
                .containsExactly("LISTENING", "READING", "WRITING");
        assertThat(workspace.getSections()).flatExtracting(section -> section.getParts())
                .extracting(part -> part.getPartNumber()).containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9);
        assertThat(workspaceJson).contains("(1) ____", "(10) ____", "nltv-p8-g1", "shared_media")
                .doesNotContain("(1) lớn nhất", "correct_answer", "explanation");
        assertThat(snapshotJson).contains("(1) ____", "correct_answer", "explanation");
        assertThat(snapshotJson).doesNotContain("(1) lớn nhất");
    }
}
