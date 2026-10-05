# Mock Data Seeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Spring Boot `CommandLineRunner` that reads a JSON file to automatically seed the database with a realistic "Mini-TOEIC" exam (covering core parts) to support E2E flow testing on development environments.

**Architecture:** 
The `exam` module currently has JPA Entities (`Exam`, `ExamSection`, `ExamPart`) but no Repositories. We will first create these Spring Data JPA repositories. Then, we will create a `MockDataSeeder` component (active only on the `dev` profile) that runs on application startup, reads a structured JSON file `src/main/resources/data/mock-toeic.json` using Jackson, and persists the exam into the database if the `exams` table is empty.

**Tech Stack:** Spring Boot, Spring Data JPA, Jackson (ObjectMapper), PostgreSQL (via JPA).

**Spec:** Requirement derived from TV3 E2E testing needs: "Tạo dữ liệu mẫu 1-2 đề thi TOEIC hoàn chỉnh (có đủ Parts, Câu hỏi, Hình ảnh/Audio, Giải thích) bằng Spring Boot Data Seeder".

## Global Constraints

- Code must follow the established Base Architecture.
- Do NOT delete or modify the existing `FixtureExamAdapter`. The seeding is for the actual database tables used by the core `exam` module.
- The seeder must be idempotent (only seed if `examRepository.count() == 0`) to prevent duplicate data on restarts.
- Must use `@Profile("dev")` so it doesn't accidentally run in production.

## Review Focus

- **Data Duplication:** If the app restarts multiple times, does it insert duplicate exams? (Addressed by checking `count() == 0`).
- **Entity Relationships:** Are `ExamSection`s correctly linked to `Exam`, and `ExamPart`s correctly linked to `ExamSection` before saving? (Addressed by setting parent references in the seeder before saving).
- **JSON Parsing Errors:** What if the JSON file is missing or malformed? (Addressed by catching exceptions and logging warnings rather than crashing the whole Spring Boot context).

---

### Task 1: Create Exam Module Repositories

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/exam/repository/ExamRepository.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/exam/repository/ExamSectionRepository.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/exam/repository/ExamPartRepository.java`

**Interfaces:**
- Produces: `ExamRepository`, `ExamSectionRepository`, `ExamPartRepository` extending `JpaRepository`.

- [ ] **Step 1: Write the ExamRepository**

```java
package com.multilingo.backend.modules.exam.repository;

import com.multilingo.backend.modules.exam.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ExamRepository extends JpaRepository<Exam, Integer> {
}
```

- [ ] **Step 2: Write the ExamSectionRepository**

```java
package com.multilingo.backend.modules.exam.repository;

import com.multilingo.backend.modules.exam.entity.ExamSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ExamSectionRepository extends JpaRepository<ExamSection, Integer> {
}
```

- [ ] **Step 3: Write the ExamPartRepository**

```java
package com.multilingo.backend.modules.exam.repository;

import com.multilingo.backend.modules.exam.entity.ExamPart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ExamPartRepository extends JpaRepository<ExamPart, Integer> {
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/multilingo/backend/modules/exam/repository/
git commit -m "feat(exam): add Spring Data repositories for Exam, Section, and Part"
```

---

### Task 2: Create Mock TOEIC JSON Data

**Files:**
- Create: `backend/src/main/resources/data/mock-toeic.json`

**Interfaces:**
- Produces: A structured JSON file representing an `Exam` with nested `sections` and `parts`.

- [ ] **Step 1: Create the mock JSON file**

Create `backend/src/main/resources/data/mock-toeic.json` with the following content (a Mini-TOEIC covering 2 sections and sample parts with questions inside `content_data`):

```json
[
  {
    "code": "TOEIC_MOCK_01",
    "title": "TOEIC Mini Mock Test 01",
    "type": "TOEIC",
    "examLanguage": "en",
    "isPublished": true,
    "isVipOnly": false,
    "durationMinutes": 120,
    "thumbnailUrl": "https://via.placeholder.com/300x200?text=TOEIC+Mock+1",
    "sections": [
      {
        "skillType": "LISTENING",
        "title": "Listening Section",
        "durationMinutes": 45,
        "audioUrl": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        "orderIndex": 1,
        "parts": [
          {
            "partNumber": 1,
            "contentData": {
              "title": "Part 1: Photographs",
              "instruction": "Listen and choose the statement that best describes the picture.",
              "questions": [
                {
                  "question_id": "q_1",
                  "question_number": 1,
                  "type": "SINGLE_CHOICE",
                  "question_text": "[Image: People in a meeting]",
                  "options": [
                    { "id": "A", "text": "They are reviewing some documents." },
                    { "id": "B", "text": "They are packing their bags." },
                    { "id": "C", "text": "They are walking outside." },
                    { "id": "D", "text": "They are eating lunch." }
                  ],
                  "correct_answer": "A",
                  "explanation": "The image shows people looking at papers, which means they are reviewing documents."
                }
              ]
            }
          }
        ]
      },
      {
        "skillType": "READING",
        "title": "Reading Section",
        "durationMinutes": 75,
        "orderIndex": 2,
        "parts": [
          {
            "partNumber": 5,
            "contentData": {
              "title": "Part 5: Incomplete Sentences",
              "instruction": "Choose the word that best completes the sentence.",
              "questions": [
                {
                  "question_id": "q_101",
                  "question_number": 101,
                  "type": "SINGLE_CHOICE",
                  "question_text": "The new software is _______ easier to use than the old one.",
                  "options": [
                    { "id": "A", "text": "much" },
                    { "id": "B", "text": "many" },
                    { "id": "C", "text": "more" },
                    { "id": "D", "text": "most" }
                  ],
                  "correct_answer": "A",
                  "explanation": "'much' is used to emphasize comparative adjectives like 'easier'."
                }
              ]
            }
          }
        ]
      }
    ]
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/resources/data/mock-toeic.json
git commit -m "feat(seed): add mock TOEIC JSON data for seeder"
```

---

### Task 3: Implement MockDataSeeder

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/config/MockDataSeeder.java`

**Interfaces:**
- Consumes: `ExamRepository`, `ExamSectionRepository`, `ExamPartRepository`, `mock-toeic.json`
- Produces: Database records on application startup in the `dev` profile.

- [ ] **Step 1: Write the Seeder class**

```java
package com.multilingo.backend.config;

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
            log.info("Database already contains exams. Skipping Mock Data Seeder.");
            return;
        }

        log.info("Starting Mock Data Seeder...");
        try {
            InputStream is = new ClassPathResource("data/mock-toeic.json").getInputStream();
            JsonNode root = objectMapper.readTree(is);
            
            for (JsonNode examNode : root) {
                Exam exam = new Exam();
                exam.setCode(examNode.get("code").asText());
                exam.setTitle(examNode.get("title").asText());
                exam.setType(examNode.get("type").asText());
                exam.setExamLanguage(examNode.get("examLanguage").asText());
                exam.setIsPublished(examNode.get("isPublished").asBoolean());
                exam.setIsVipOnly(examNode.get("isVipOnly").asBoolean());
                exam.setDurationMinutes(examNode.get("durationMinutes").asInt());
                if (examNode.has("thumbnailUrl")) {
                    exam.setThumbnailUrl(examNode.get("thumbnailUrl").asText());
                }
                
                Exam savedExam = examRepository.save(exam);
                
                if (examNode.has("sections")) {
                    for (JsonNode sectionNode : examNode.get("sections")) {
                        ExamSection section = new ExamSection();
                        section.setExam(savedExam);
                        section.setSkillType(sectionNode.get("skillType").asText());
                        section.setTitle(sectionNode.get("title").asText());
                        section.setDurationMinutes(sectionNode.get("durationMinutes").asInt());
                        section.setOrderIndex(sectionNode.get("orderIndex").asInt());
                        if (sectionNode.has("audioUrl")) {
                            section.setAudioUrl(sectionNode.get("audioUrl").asText());
                        }
                        
                        ExamSection savedSection = examSectionRepository.save(section);
                        
                        if (sectionNode.has("parts")) {
                            for (JsonNode partNode : sectionNode.get("parts")) {
                                ExamPart part = new ExamPart();
                                part.setSection(savedSection);
                                part.setPartNumber(partNode.get("partNumber").asInt());
                                part.setContentData(partNode.get("contentData").toString()); // JSONB is mapped as String in entity
                                
                                examPartRepository.save(part);
                            }
                        }
                    }
                }
            }
            log.info("Mock Data Seeding completed successfully.");
            
        } catch (Exception e) {
            log.error("Failed to seed mock data", e);
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/java/com/multilingo/backend/config/MockDataSeeder.java
git commit -m "feat(seed): implement MockDataSeeder to load exams from JSON"
```
