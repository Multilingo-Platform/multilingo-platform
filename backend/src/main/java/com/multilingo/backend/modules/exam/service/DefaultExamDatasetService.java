package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.*;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class DefaultExamDatasetService {
    private final ExamRepository repository;
    private final AdminExamService admin;
    private final ObjectMapper mapper;

    public DefaultExamDatasetService(ExamRepository repository, AdminExamService admin, ObjectMapper mapper) {
        this.repository = repository;
        this.admin = admin;
        this.mapper = mapper;
    }

    @Transactional
    public int seedClasspath(Resource[] resources) {
        var bundles = new ArrayList<ExamDatasetBundle>();
        for (var resource : resources) {
            try (var input = resource.getInputStream()) {
                bundles.add(mapper.readValue(input, ExamDatasetBundle.class));
            } catch (Exception e) { throw new AppException(ErrorCode.INVALID_IMPORT_FILE); }
        }
        return seed(bundles);
    }

    /** Validate all bundles before writing; the enclosing transaction is all-or-nothing. */
    @Transactional
    public int seed(List<ExamDatasetBundle> bundles) {
        Set<String> codes = new HashSet<>();
        for (var bundle : bundles) {
            bundle.validate();
            if (!codes.add(bundle.examCode())) throw new AppException(ErrorCode.CONFLICT);
        }
        int created = 0;
        for (var bundle : bundles) {
            var existing = repository.findByCode(bundle.examCode());
            if (existing.isPresent()) {
                if (!ExamDatasetBundle.digest(admin.getExamDetail(existing.get().getId())).equals(bundle.checksum()))
                    throw new AppException(ErrorCode.CONFLICT, "Mã dataset đã tồn tại với nội dung khác; không ghi đè.");
            } else {
                admin.createExamWithCode(ExamDatasetBundle.canonical(bundle.request()), bundle.examCode());
                created++;
            }
        }
        // Flush also detects concurrent unique-code races before reporting success.
        repository.flush();
        return created;
    }
}
