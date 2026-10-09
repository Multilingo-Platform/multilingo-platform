package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.response.LearnerExamStructureResponse;
import com.multilingo.backend.modules.testing.service.LearnerExamStructureService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.emptyOrNullString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LearnerExamStructureControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LearnerExamStructureService examStructureService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUser(roles = "USER")
    void getExamStructure_Success_AuthenticatedLearner() throws Exception {
        LearnerExamStructureResponse response = LearnerExamStructureResponse.builder()
                .id(9)
                .code("IELTS-1")
                .title("IELTS Mock")
                .type("IELTS")
                .durationMinutes(120)
                .sections(List.of(
                        LearnerExamStructureResponse.Section.builder()
                                .id(70)
                                .skillType("READING")
                                .title("Reading Section")
                                .durationMinutes(60)
                                .orderIndex(1)
                                .parts(List.of(
                                        LearnerExamStructureResponse.Part.builder()
                                                .id(701)
                                                .partNumber(1)
                                                .title("Reading Part 1")
                                                .build()
                                ))
                                .build()
                ))
                .build();

        when(examStructureService.getPublishedExamStructure(9)).thenReturn(response);

        mockMvc.perform(get("/api/v1/exams/9/structure")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data.id").value(9))
                .andExpect(jsonPath("$.data.code").value("IELTS-1"))
                .andExpect(jsonPath("$.data.title").value("IELTS Mock"))
                .andExpect(jsonPath("$.data.type").value("IELTS"))
                .andExpect(jsonPath("$.data.durationMinutes").value(120))
                .andExpect(jsonPath("$.data.sections[0].id").value(70))
                .andExpect(jsonPath("$.data.sections[0].skillType").value("READING"))
                .andExpect(jsonPath("$.data.sections[0].title").value("Reading Section"))
                .andExpect(jsonPath("$.data.sections[0].durationMinutes").value(60))
                .andExpect(jsonPath("$.data.sections[0].orderIndex").value(1))
                .andExpect(jsonPath("$.data.sections[0].parts[0].id").value(701))
                .andExpect(jsonPath("$.data.sections[0].parts[0].partNumber").value(1))
                .andExpect(jsonPath("$.data.sections[0].parts[0].title").value("Reading Part 1"))
                .andExpect(jsonPath("$.timestamp").value(not(emptyOrNullString())));
    }

    @Test
    @WithMockUser(roles = "USER")
    void getExamStructure_NotFound_WhenMissingOrUnpublished() throws Exception {
        when(examStructureService.getPublishedExamStructure(404))
                .thenThrow(new AppException(ErrorCode.EXAM_NOT_FOUND));

        mockMvc.perform(get("/api/v1/exams/404/structure")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value(1401));
    }

    @Test
    void getExamStructure_Forbidden_WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/exams/9/structure")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());

        verify(examStructureService, never()).getPublishedExamStructure(any());
    }

    @Test
    @WithMockUser(roles = "USER")
    void getExamStructure_WhitelistSerialization_ExcludesSensitiveFields() throws Exception {
        LearnerExamStructureResponse response = LearnerExamStructureResponse.builder()
                .id(9)
                .code("IELTS-1")
                .title("IELTS Mock")
                .type("IELTS")
                .durationMinutes(120)
                .sections(List.of(
                        LearnerExamStructureResponse.Section.builder()
                                .id(70)
                                .skillType("READING")
                                .title("Reading Section")
                                .durationMinutes(60)
                                .orderIndex(1)
                                .parts(List.of(
                                        LearnerExamStructureResponse.Part.builder()
                                                .id(701)
                                                .partNumber(1)
                                                .title("Reading Part 1")
                                                .build()
                                ))
                                .build()
                ))
                .build();

        when(examStructureService.getPublishedExamStructure(9)).thenReturn(response);

        mockMvc.perform(get("/api/v1/exams/9/structure")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isPublished").doesNotExist())
                .andExpect(jsonPath("$.data.isVipOnly").doesNotExist())
                .andExpect(jsonPath("$.data.createdBy").doesNotExist())
                .andExpect(jsonPath("$.data.createdAt").doesNotExist())
                .andExpect(jsonPath("$.data.updatedAt").doesNotExist())
                .andExpect(jsonPath("$.data.audioUrl").doesNotExist())
                .andExpect(jsonPath("$.data.thumbnailUrl").doesNotExist())
                .andExpect(jsonPath("$.data.contentData").doesNotExist())
                .andExpect(jsonPath("$.data.questions").doesNotExist())
                .andExpect(jsonPath("$.data.questionGroups").doesNotExist())
                .andExpect(jsonPath("$.data.instruction").doesNotExist())
                .andExpect(jsonPath("$.data.contentHtml").doesNotExist())
                .andExpect(jsonPath("$.data.correctAnswer").doesNotExist())
                .andExpect(jsonPath("$.data.correct_answer").doesNotExist())
                .andExpect(jsonPath("$.data.solution").doesNotExist())
                .andExpect(jsonPath("$.data.explanation").doesNotExist())
                .andExpect(jsonPath("$.data.gradingKey").doesNotExist())
                .andExpect(jsonPath("$.data.gradingKeys").doesNotExist())
                .andExpect(jsonPath("$.data.aiPromptContext").doesNotExist())
                .andExpect(jsonPath("$.data.ai_prompt_context").doesNotExist())
                .andExpect(jsonPath("$.data.sections[0].parts[0].contentData").doesNotExist())
                .andExpect(jsonPath("$.data.sections[0].parts[0].questions").doesNotExist())
                .andExpect(jsonPath("$.data.sections[0].parts[0].correctAnswer").doesNotExist())
                .andExpect(jsonPath("$.data.sections[0].parts[0].solution").doesNotExist());
    }
}
