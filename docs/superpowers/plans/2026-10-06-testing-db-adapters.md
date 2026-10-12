# Kết nối Module Testing với Dữ liệu thực từ Database (DbExamAdapter & DbGradingAdapter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế FixtureAdapter bằng DbAdapter để lấy dữ liệu đề thi và đáp án từ Database thực (do TV2 cung cấp) cho quá trình làm bài và chấm điểm của TV3.

**Architecture:** Tạo 2 class `DbExamAdapter` và `DbGradingAdapter` triển khai interface `ExamAdapter` và `GradingAdapter`. Gắn `@Primary` để ưu tiên inject. Đọc từ `ExamRepository` và mapping JSON `content_data`.

**Tech Stack:** Java 21, Spring Boot, Jackson, JPA.

**Spec:** `docs/superpowers/specs/2026-10-06-testing-db-adapters-design.md`

## Global Constraints
- `ExamFixture` không được chứa `correct_answer` và `explanation`.
- Phải tránh dùng anonymous inner class `new TypeReference<List<Map<String, Object>>>() {}` với Jackson để tránh bug Lombok trên JDK 21. Ép kiểu trực tiếp.
- Các file mới phải đặt tại `com.multilingo.backend.modules.testing.adapter.impl`.

## Review Focus
- Bảo mật đáp án: Đảm bảo DbExamAdapter đã remove `correct_answer` và `explanation` trước khi trả về Frontend.
- Lỗi biên dịch: Lombok JDK 21 issue. Có thể cần cập nhật lombok.version trong pom.xml nếu vẫn bị.

---

### Task 1: Sửa lỗi biên dịch Lombok + JDK 21 (Nếu cần thiết)

**Files:**
- Modify: `backend/pom.xml`

**Interfaces:** N/A

- [ ] **Step 1: Cập nhật version lombok trong pom.xml (để phòng ngừa ExceptionInInitializerError)**
```xml
<!-- Thêm vào thẻ <properties> -->
<lombok.version>1.18.30</lombok.version>
```

- [ ] **Step 2: Commit**
```bash
git add backend/pom.xml
git commit -m "fix: update lombok version to fix JDK 21 compatibility"
```

### Task 2: Implement DbExamAdapter

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/DbExamAdapter.java`

**Interfaces:**
- Produces: `ExamAdapter` (Spring Bean `@Primary`)

- [ ] **Step 1: Viết implementation DbExamAdapter**
```java
package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.adapter.dto.PartFixture;
import com.multilingo.backend.modules.testing.adapter.dto.SectionFixture;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@Primary
@RequiredArgsConstructor
public class DbExamAdapter implements ExamAdapter {

    private final ExamRepository examRepository;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<ExamFixture> findById(Integer examId) {
        return examRepository.findById(examId).map(this::mapToFixture);
    }

    @SuppressWarnings("unchecked")
    private ExamFixture mapToFixture(Exam exam) {
        ExamFixture fixture = new ExamFixture();
        fixture.setId(exam.getId());
        fixture.setTitle(exam.getTitle());
        fixture.setDurationMinutes(exam.getDurationMinutes());

        List<SectionFixture> sections = exam.getSections().stream()
                .map(section -> {
                    SectionFixture sFixture = new SectionFixture();
                    sFixture.setId(section.getId());
                    sFixture.setName(section.getSkillType());
                    sFixture.setDurationMinutes(section.getDurationMinutes());

                    List<PartFixture> parts = section.getParts().stream()
                            .map(part -> {
                                PartFixture pFixture = new PartFixture();
                                pFixture.setId(part.getId());
                                
                                Map<String, Object> data = part.getContentData();
                                if (data != null) {
                                    if (data.containsKey("title")) {
                                        pFixture.setTitle(data.get("title").toString());
                                    }
                                    if (data.containsKey("instruction")) {
                                        pFixture.setInstruction(data.get("instruction").toString());
                                    }
                                    if (data.containsKey("questions")) {
                                        // Ép kiểu thay vì dùng TypeReference ẩn danh để tránh lỗi Lombok AST
                                        List<Map<String, Object>> rawQuestions = (List<Map<String, Object>>) data.get("questions");
                                        
                                        // Clone và strip
                                        List<Object> strippedQuestions = rawQuestions.stream().map(q -> {
                                            // Deep copy để không sửa vào Entity gốc đang được JPA quản lý
                                            Map<String, Object> copy = objectMapper.convertValue(q, Map.class);
                                            copy.remove("correct_answer");
                                            copy.remove("explanation");
                                            return (Object) copy;
                                        }).collect(Collectors.toList());
                                        pFixture.setQuestions(strippedQuestions);
                                    }
                                }
                                return pFixture;
                            })
                            .collect(Collectors.toList());

                    sFixture.setParts(parts);
                    return sFixture;
                })
                .collect(Collectors.toList());

        fixture.setSections(sections);
        return fixture;
    }
}
```

- [ ] **Step 2: Commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/DbExamAdapter.java
git commit -m "feat: implement DbExamAdapter to read exam from database"
```

### Task 3: Implement DbGradingAdapter

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/DbGradingAdapter.java`

**Interfaces:**
- Produces: `GradingAdapter` (Spring Bean `@Primary`)

- [ ] **Step 1: Viết implementation DbGradingAdapter**
```java
package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@Primary
@RequiredArgsConstructor
public class DbGradingAdapter implements GradingAdapter {

    private final ExamRepository examRepository;
    private final ObjectMapper objectMapper;

    @SuppressWarnings("unchecked")
    @Override
    public Map<Integer, PartGradingKey> loadPartKeys(Integer examId) {
        Map<Integer, PartGradingKey> partKeys = new HashMap<>();

        Optional<Exam> examOpt = examRepository.findById(examId);
        if (examOpt.isEmpty()) {
            return partKeys;
        }

        Exam exam = examOpt.get();

        exam.getSections().forEach(section -> {
            section.getParts().forEach(part -> {
                PartGradingKey partGradingKey = new PartGradingKey();
                partGradingKey.setPartId(part.getId());
                partGradingKey.setSectionName(section.getSkillType());
                
                Map<String, GradingKey> answers = new HashMap<>();
                
                Map<String, Object> data = part.getContentData();
                if (data != null && data.containsKey("questions")) {
                    List<Map<String, Object>> questions = (List<Map<String, Object>>) data.get("questions");
                    
                    for (Map<String, Object> q : questions) {
                        String questionId = (String) q.get("question_id");
                        if (questionId == null || !q.containsKey("correct_answer")) {
                            continue;
                        }

                        GradingKey key = new GradingKey();
                        key.setQuestionId(questionId);
                        key.setType((String) q.get("type"));
                        key.setCorrect(q.get("correct_answer"));
                        
                        if (q.containsKey("alternates")) {
                            // alternates cũng là list chuỗi
                            List<String> alts = (List<String>) q.get("alternates");
                            key.setAlternates(alts);
                        }
                        
                        answers.put(questionId, key);
                    }
                }
                
                partGradingKey.setAnswers(answers);
                partKeys.put(part.getId(), partGradingKey);
            });
        });

        return partKeys;
    }
}
```

- [ ] **Step 2: Chạy kiểm thử biên dịch**
Run: `mvn clean compile` trong thư mục `backend`
Expected: SUCCESS

- [ ] **Step 3: Commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/DbGradingAdapter.java
git commit -m "feat: implement DbGradingAdapter to read answer keys from database"
```
