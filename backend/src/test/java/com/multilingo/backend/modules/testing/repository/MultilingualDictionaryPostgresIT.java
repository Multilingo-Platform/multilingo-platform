package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.support.*;
import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV2Request;
import com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupV2OutputParser.DictionaryLookupDefinitionV2;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupTransactionCoordinator;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.analytics.service.DictionaryLookupQuotaService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.*;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.aop.support.AopUtils;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="TV3_PG_TEST_URL",matches="jdbc:postgresql:.*")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class MultilingualDictionaryPostgresIT extends MultilingualIntegrationSupport {
    private static final MultilingualPostgresDatabase database=new MultilingualPostgresDatabase();
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry)throws Exception{database.configure(registry);}
    @AfterAll void cleanupSchema()throws Exception{database.close();}

    @Test void concurrentUuidReservesOnceAndReplayKeepsLanguageAfterProfileChanges()throws Exception{
        assertThat(AopUtils.isAopProxy(dictionaryCoordinator)).isTrue();
        var seed=publish("ja");int id=start(seed,TestMode.PRACTICE);
        var request=new DictionaryLookupV2Request(UUID.randomUUID().toString(),seed.readingPart(),"passage","水","水 a café Việt 日本語",null);
        List<Object> decisions=race(()->dictionaryCoordinator.beginV2(actor.getId(),id,request));
        var reserved=decisions.stream().filter(DictionaryLookupTransactionCoordinator.Reserved.class::isInstance)
                .map(DictionaryLookupTransactionCoordinator.Reserved.class::cast).toList();
        assertThat(reserved).hasSize(1);
        assertThat(decisions.stream().filter(com.multilingo.backend.common.exception.AppException.class::isInstance).count()).isEqualTo(1);
        var token=reserved.getFirst().reservation();
        assertThat(quotas.findById(token.quotaId()).orElseThrow().getUsedCount()).isEqualTo(1);
        var generated=new DictionaryLookupDefinitionV2("Nghĩa",null,null,"水","Nước");
        var completed=dictionaryCoordinator.completeV2(token,generated).orElseThrow();
        actor.setNativeLanguage("fr");users.saveAndFlush(actor);
        assertThat(dictionary.lookup(id,request)).isEqualTo(completed);
        assertThat(completed.definition().meaningLanguage()).isEqualTo("vi");
        assertThatThrownBy(()->dictionaryCoordinator.beginV2(actor.getId(),id,new DictionaryLookupV2Request(request.requestId(),seed.readingPart(),"passage","水",request.contextText(),"de")))
                .isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        verifyNoInteractions(gemini);
    }

    @Test void expiredReservationRefundsOnceAndLateCompletionCannotPublish()throws Exception{
        var seed=publish("vi");int id=start(seed,TestMode.PRACTICE);
        var request=new DictionaryLookupV2Request(UUID.randomUUID().toString(),seed.readingPart(),"passage","水","水 a café Việt 日本語","en");
        var token=((DictionaryLookupTransactionCoordinator.Reserved)dictionaryCoordinator.beginV2(actor.getId(),id,request)).reservation();
        var ledger=dictionaryRecords.findById(token.ledgerId()).orElseThrow();
        ledger.setLeaseUntil(Instant.now().minusSeconds(5));dictionaryRecords.saveAndFlush(ledger);
        assertThat(dictionaryCoordinator.recoverExpiredForUser(actor.getId(),Instant.now())).isEqualTo(1);
        assertThat(dictionaryCoordinator.recoverExpiredForUser(actor.getId(),Instant.now())).isZero();
        assertThat(dictionaryCoordinator.completeV2(token,new DictionaryLookupDefinitionV2("old",null,null,"水","water"))).isEmpty();
        assertThat(quotas.findById(token.quotaId()).orElseThrow().getUsedCount()).isZero();
        assertThat(dictionaryCoordinator.fail(token,"LATE")).isFalse();
    }

    private List<Object> race(Callable<Object> action)throws Exception{
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()){
            var gate=new CountDownLatch(1);
            Callable<Object> call=()->{gate.await();try{return action.call();}catch(com.multilingo.backend.common.exception.AppException error){return error;}};
            var a=pool.submit(call);var b=pool.submit(call);gate.countDown();return List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));
        }
    }
}
