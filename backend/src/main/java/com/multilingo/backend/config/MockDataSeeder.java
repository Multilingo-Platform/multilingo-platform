package com.multilingo.backend.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.util.Map;

@Slf4j
@Component
@Profile("dev")
@RequiredArgsConstructor
public class MockDataSeeder implements CommandLineRunner {

    private final ExamRepository examRepository;
    private final ExamSectionRepository examSectionRepository;
    private final ExamPartRepository examPartRepository;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public void run(String... args) {
        if (examRepository.count() > 0) {
            log.info("Database already contains exams ({} found). Skipping Mock Data Seeder.", examRepository.count());
            return;
        }

        log.info("Starting Mock Data Seeder for development...");
        try {
            ClassPathResource resource = new ClassPathResource("data/mock-toeic.json");
            if (!resource.exists()) {
                log.warn("Mock data file data/mock-toeic.json does not exist. Skipping seeding.");
                return;
            }

            try (InputStream is = resource.getInputStream()) {
                JsonNode root = objectMapper.readTree(is);

                for (JsonNode examNode : root) {
                    Exam exam = Exam.builder()
                            .code(examNode.path("code").asText())
                            .title(examNode.path("title").asText())
                            .type(examNode.path("type").asText())
                            .examLanguage(examNode.path("examLanguage").asText("en"))
                            .isPublished(examNode.path("isPublished").asBoolean(true))
                            .isVipOnly(examNode.path("isVipOnly").asBoolean(false))
                            .durationMinutes(examNode.path("durationMinutes").asInt(120))
                            .thumbnailUrl(examNode.hasNonNull("thumbnailUrl") ? examNode.get("thumbnailUrl").asText() : null)
                            .build();

                    Exam savedExam = examRepository.save(exam);
                    log.info("Seeded exam: [{}] {}", savedExam.getCode(), savedExam.getTitle());

                    if (examNode.has("sections")) {
                        for (JsonNode sectionNode : examNode.get("sections")) {
                            ExamSection section = ExamSection.builder()
                                    .exam(savedExam)
                                    .skillType(sectionNode.path("skillType").asText())
                                    .title(sectionNode.path("title").asText())
                                    .durationMinutes(sectionNode.path("durationMinutes").asInt(60))
                                    .orderIndex(sectionNode.path("orderIndex").asInt(1))
                                    .audioUrl(sectionNode.hasNonNull("audioUrl") ? sectionNode.get("audioUrl").asText() : null)
                                    .build();

                            ExamSection savedSection = examSectionRepository.save(section);

                            if (sectionNode.has("parts")) {
                                for (JsonNode partNode : sectionNode.get("parts")) {
                                    Map<String, Object> contentData = objectMapper.convertValue(
                                            partNode.get("contentData"),
                                            new TypeReference<Map<String, Object>>() {}
                                    );

                                    ExamPart part = ExamPart.builder()
                                            .section(savedSection)
                                            .partNumber(partNode.get("partNumber").asInt())
                                            .contentData(contentData)
                                            .build();

                                    examPartRepository.save(part);
                                }
                            }
                        }
                    }
                }
            }
            log.info("Mock Data Seeding completed successfully. Seeded {} exams.", examRepository.count());

        } catch (Exception e) {
            log.error("Failed to seed mock data", e);
        }
    }
}
