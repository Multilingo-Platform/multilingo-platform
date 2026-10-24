package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.modules.testing.support.*;
import com.multilingo.backend.modules.testing.ai.grading.*;
import com.multilingo.backend.modules.testing.entity.enums.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.*;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.aop.support.AopUtils;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="TV3_PG_TEST_URL",matches="jdbc:postgresql:.*")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class MultilingualWritingPostgresIT extends MultilingualIntegrationSupport {
    private static final MultilingualPostgresDatabase database=new MultilingualPostgresDatabase();
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry)throws Exception{database.configure(registry);}
    @AfterAll void cleanupSchema()throws Exception{database.close();}
    @Autowired WritingGradingGenerator generator;

    @Test void twoWorkersClaimOnceAndOldRunCannotCompleteAfterRetry()throws Exception{
        assertThat(AopUtils.isAopProxy(gradingCoordinator)).isTrue();
        var seed=publish("ja");int id=start(seed,TestMode.PRACTICE);submit(id,seed,"猫が好きです。","fr");
        var job=jobs.findAllByAttemptId(id).getFirst();
        List<ClaimDecision> decisions;
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
            var gate=new CountDownLatch(1);Callable<ClaimDecision> task=()->{gate.await();return gradingCoordinator.claim(job.getId());};
            var a=pool.submit(task);var b=pool.submit(task);gate.countDown();decisions=List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));
        }
        var grants=decisions.stream().filter(ClaimDecision.Granted.class::isInstance).map(ClaimDecision.Granted.class::cast).toList();
        assertThat(grants).hasSize(1);Claim old=grants.getFirst().claim();
        gradingCoordinator.fail(old,WritingGradingFailure.retryable("UPSTREAM","Test provider timeout"));
        var retry=jobs.findById(job.getId()).orElseThrow();retry.setNextAttemptAt(Instant.now().minusSeconds(1));jobs.saveAndFlush(retry);
        var current=((ClaimDecision.Granted)gradingCoordinator.claim(job.getId())).claim();
        assertThat(current.runId()).isNotEqualTo(old.runId());
        assertThat(current.context().feedbackLanguage()).isEqualTo("fr");
        var grade=generator.generate(current.context());
        gradingCoordinator.complete(old,grade);
        assertThat(jobs.findById(job.getId()).orElseThrow().getStatus()).isEqualTo(WritingGradingJobStatus.RUNNING);
        gradingCoordinator.complete(current,grade);
        var completed=jobs.findById(job.getId()).orElseThrow();
        assertThat(completed.getResultJson()).containsEntry("schemaVersion",2).containsEntry("sourceLanguage","ja")
                .containsEntry("rubricCode","WRITING_GENERIC_V1").containsEntry("feedbackLanguage","fr");
        assertThat(feedback.getWritingFeedback(id,seed.writingPart()).tasks().getFirst().overall()).isEqualByComparingTo("10");
    }
}
