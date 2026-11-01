package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.modules.testing.support.MultilingualIntegrationSupport;
import com.multilingo.backend.modules.testing.dto.request.*;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.service.PracticeDictionaryV3Service;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupTransactionCoordinator;
import com.multilingo.backend.common.exception.AppException;
import org.springframework.beans.factory.annotation.Autowired;
import org.junit.jupiter.api.*;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real services/coordinator/repositories; only external provider/media are faked by support. */
@org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="TV3_PG_TEST_URL",matches="jdbc:postgresql:.*")
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
public class WorkspaceDictionaryLifecycleIT extends MultilingualIntegrationSupport {
    @Autowired protected PracticeDictionaryV3Service dictionaryV3;
    @Autowired protected com.multilingo.backend.modules.vocab.service.FlashcardDeckService decks;
    @Autowired protected com.multilingo.backend.modules.vocab.service.UserFlashcardService cards;
    private static final com.multilingo.backend.modules.testing.support.MultilingualPostgresDatabase database = new com.multilingo.backend.modules.testing.support.MultilingualPostgresDatabase();
    @org.springframework.test.context.DynamicPropertySource static void database(org.springframework.test.context.DynamicPropertyRegistry registry) throws Exception { database.configure(registry); }
    @AfterAll protected void cleanupDatabase() throws Exception { database.close(); }
    protected DictionaryLookupV3Request request(int part) {
        return new DictionaryLookupV3Request(UUID.randomUUID().toString(), part,
                WorkspaceTextSource.option("objective", "A"), "Yes", "Yes");
    }
    @Test void nativeReplayConflictAndSubmitPreserveAnswerState() throws Exception {
        var seed = publish("en"); int id = start(seed, TestMode.PRACTICE);
        var before = attemptRepository.findById(id).orElseThrow();
        int version = before.getVersion(); var updated = before.getUpdatedAt();
        var request = request(seed.readingPart());
        var result = dictionaryV3.lookup(id, request);
        assertThat(result.policyVersion()).isEqualTo("NATIVE_PROFILE_V1");
        assertThat(result.definition().meaningLanguage()).isEqualTo("vi");
        var deck = decks.createDeck(com.multilingo.backend.modules.vocab.dto.request.CreateDeckRequest.builder()
                .name("RD09 fixture deck").targetLanguage(result.definition().learningLanguage())
                .sourceLanguage(result.definition().meaningLanguage()).isPublic(false).build(), actor.getId());
        var card = cards.addCard(deck.getId(), com.multilingo.backend.modules.vocab.dto.request.CreateFlashcardRequest.builder()
                .customWord(result.selectedText()).customMeaning(result.definition().meaning()).exampleSentence(result.sourceContext()).build(), actor.getId());
        assertThat(cards.getCardsInDeck(deck.getId(), null, null, actor.getId())).anySatisfy(saved -> {
            assertThat(saved.getId()).isEqualTo(card.getId());
            assertThat(saved.getCustomMeaning()).isEqualTo(result.definition().meaning());
        });
        actor.setNativeLanguage("fr"); users.saveAndFlush(actor);
        assertThat(dictionaryV3.lookup(id, request)).isEqualTo(result);
        var previous = dictionaryRecords.findAll().stream().filter(row -> row.getRequestId().equals(request.requestId())).findFirst().orElseThrow();
        previous.setLastStartedAt(Instant.now().minusSeconds(60)); dictionaryRecords.saveAndFlush(previous);
        assertThat(dictionaryV3.lookup(id, request(seed.readingPart())).definition().meaningLanguage()).isEqualTo("fr");
        assertThatThrownBy(() -> dictionaryV3.lookup(id, new DictionaryLookupV3Request(request.requestId(), seed.readingPart(),
                WorkspaceTextSource.option("objective", "B"), "No", "No"))).isInstanceOf(AppException.class);
        var after = attemptRepository.findById(id).orElseThrow();
        assertThat(after.getVersion()).isEqualTo(version);
        assertThat(after.getUpdatedAt()).isEqualTo(updated);
        assertThat(attempts.getAttemptWorkspace(id).getSavedAnswers()).isEmpty();
        submit(id, seed, "", "vi");
        assertThatThrownBy(() -> dictionaryV3.lookup(id, request(seed.readingPart()))).isInstanceOf(AppException.class);
    }
    @Test void mockAndMissingNativeAreRejectedBeforeProvider() throws Exception {
        var seed = publish("en"); int mock = start(seed, TestMode.MOCK_TEST);
        assertThatThrownBy(() -> dictionaryV3.lookup(mock, request(seed.readingPart()))).isInstanceOf(AppException.class);
        int practice = start(seed, TestMode.PRACTICE);
        actor.setNativeLanguage(""); users.saveAndFlush(actor);
        assertThatThrownBy(() -> dictionaryV3.lookup(practice, request(seed.readingPart()))).isInstanceOf(AppException.class);
        verifyNoInteractions(gemini);
    }
    @Test void recoveryRefundsOnceAndFencesLateCompletion() throws Exception {
        var seed = publish("en"); int id = start(seed, TestMode.PRACTICE);
        var token = ((DictionaryLookupTransactionCoordinator.Reserved)dictionaryCoordinator.beginV3(actor.getId(), id, request(seed.readingPart()))).reservation();
        var ledger = dictionaryRecords.findById(token.ledgerId()).orElseThrow();
        ledger.setLeaseUntil(Instant.now().minusSeconds(5)); dictionaryRecords.saveAndFlush(ledger);
        assertThat(dictionaryCoordinator.recoverExpiredForUser(actor.getId(), Instant.now())).isEqualTo(1);
        assertThat(dictionaryCoordinator.recoverExpiredForUser(actor.getId(), Instant.now())).isZero();
        assertThat(quotas.findById(token.quotaId()).orElseThrow().getUsedCount()).isZero();
        assertThat(dictionaryCoordinator.completeV3(token, new com.multilingo.backend.modules.testing.ai.dictionary.DictionaryLookupV2OutputParser.DictionaryLookupDefinitionV2("meaning", null, null, "Yes", "Có"))).isEmpty();
        assertThat(dictionaryCoordinator.fail(token,"LATE")).isFalse();
    }
}
