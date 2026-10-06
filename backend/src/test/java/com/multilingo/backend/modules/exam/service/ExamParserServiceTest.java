package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamParserServiceTest {

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private ExamParserService examParserService;

    @Test
    void parseExamFile_Success() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "exam.json", "application/json", "{\"title\":\"Test\"}".getBytes());
        ExamBuilderRequest request = ExamBuilderRequest.builder().title("Test").build();

        when(objectMapper.readValue(any(InputStream.class), eq(ExamBuilderRequest.class))).thenReturn(request);

        ExamBuilderRequest result = examParserService.parseExamFile(file);

        assertThat(result).isNotNull();
        assertThat(result.getTitle()).isEqualTo("Test");
    }

    @Test
    void parseExamFile_EmptyFile() {
        MockMultipartFile file = new MockMultipartFile("file", "exam.json", "application/json", new byte[0]);

        assertThatThrownBy(() -> examParserService.parseExamFile(file))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Định dạng file không hợp lệ hoặc cấu trúc sai");
    }

    @Test
    void parseExamFile_InvalidJson() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "exam.json", "application/json", "invalid".getBytes());

        when(objectMapper.readValue(any(InputStream.class), eq(ExamBuilderRequest.class))).thenThrow(new RuntimeException("Parse error"));

        assertThatThrownBy(() -> examParserService.parseExamFile(file))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Định dạng file không hợp lệ hoặc cấu trúc sai");
    }
    
    @Test
    void parseExamFile_UnsupportedExtension() {
        MockMultipartFile file = new MockMultipartFile("file", "exam.txt", "text/plain", "content".getBytes());

        assertThatThrownBy(() -> examParserService.parseExamFile(file))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Định dạng file không hợp lệ hoặc cấu trúc sai");
    }
}
