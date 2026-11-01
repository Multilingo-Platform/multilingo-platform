package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.controller.WorkspaceDictionaryLifecycleIT;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupTransactionCoordinator;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.annotation.DirtiesContext;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="TV3_PG_TEST_URL",matches="jdbc:postgresql:.*")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class WorkspaceDictionaryPostgresIT extends WorkspaceDictionaryLifecycleIT {
    @Test void concurrentV3UuidReservesExactlyOnce() throws Exception {
        var seed = publish("en"); int id = start(seed, TestMode.PRACTICE); var request = request(seed.readingPart());
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var gate = new CountDownLatch(1);
            Callable<Object> call = () -> { gate.await(); try { return dictionaryCoordinator.beginV3(actor.getId(),id,request); }
                catch (com.multilingo.backend.common.exception.AppException error) { return error; } };
            var a=pool.submit(call); var b=pool.submit(call); gate.countDown();
            var results=java.util.List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));
            assertThat(results.stream().filter(DictionaryLookupTransactionCoordinator.Reserved.class::isInstance).count()).isEqualTo(1);
            assertThat(results.stream().filter(AppException.class::isInstance).map(AppException.class::cast).toList())
                    .singleElement().satisfies(error -> assertThat(error.getErrorCode()).isEqualTo(ErrorCode.DICTIONARY_LOOKUP_IN_PROGRESS));
            var token=results.stream().filter(DictionaryLookupTransactionCoordinator.Reserved.class::isInstance).map(DictionaryLookupTransactionCoordinator.Reserved.class::cast).findFirst().orElseThrow().reservation();
            assertThat(quotas.findById(token.quotaId()).orElseThrow().getUsedCount()).isEqualTo(1);
            assertThat(dictionaryCoordinator.fail(token,"TEST_CLEANUP")).isTrue();
            assertThat(dictionaryCoordinator.fail(token,"TEST_CLEANUP")).isFalse();
            assertThat(quotas.findById(token.quotaId()).orElseThrow().getUsedCount()).isZero();
        }
    }
}
