package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.modules.testing.support.*;
import com.multilingo.backend.modules.testing.dto.request.*;
import com.multilingo.backend.modules.testing.entity.enums.*;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@EnabledIfEnvironmentVariable(named="TV3_PG_TEST_URL",matches="jdbc:postgresql:.*")
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class MultilingualTv3LifecycleIT extends MultilingualIntegrationSupport {
    private static final MultilingualPostgresDatabase database=new MultilingualPostgresDatabase();
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry)throws Exception{database.configure(registry);}
    @AfterAll void cleanupSchema()throws Exception{database.close();}

    @ParameterizedTest @ValueSource(strings={"en","vi","ko","zh","ja","fr","de","es"})
    void publishedExamDictionaryHintsSubmitWorkerResultAndHistoryUseFrozenLanguage(String language)throws Exception{
        var seed=publish(language);int id=start(seed,TestMode.PRACTICE);
        var lookup=new DictionaryLookupV2Request(UUID.randomUUID().toString(),seed.readingPart(),"passage","水","水 a café Việt 日本語","fr");
        var definition=dictionary.lookup(id,lookup);
        assertThat(definition.definition().schemaVersion()).isEqualTo(2);
        assertThat(definition.definition().learningLanguage()).isEqualTo(language);
        assertThat(definition.definition().meaningLanguage()).isEqualTo("fr");
        var suggestion=hints.generate(id,new WritingHintsRequest(seed.writingPart(),"essay",UUID.randomUUID().toString(),null,"fr"));
        assertThat(suggestion.learningLanguage()).isEqualTo(language);
        assertThat(suggestion.hintLanguage()).isEqualTo("fr");

        var principal=user(new CustomUserDetails(actor));
        var deckResponse=mvc.perform(post("/api/v1/vocab/decks").with(principal).contentType("application/json")
                .content(mapper.writeValueAsString(Map.of("name","Lookup "+UUID.randomUUID(),"targetLanguage",language,"sourceLanguage","fr","isPublic",false))))
                .andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString();
        int deck=mapper.readTree(deckResponse).path("data").path("id").asInt();
        assertThat(deck).isPositive();
        mvc.perform(post("/api/v1/vocab/decks/"+deck+"/cards").with(principal).contentType("application/json")
                .content(mapper.writeValueAsString(Map.of("customWord","水","customMeaning",definition.definition().meaning(),"exampleSentence",definition.sourceContext()))))
                .andExpect(status().is2xxSuccessful());
        var cards=mvc.perform(get("/api/v1/vocab/decks/"+deck+"/cards").with(principal)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(mapper.readTree(cards).path("data").get(0).path("customMeaning").asText()).isEqualTo("Définition vérifiée");
        authenticate(actor); // MockMvc's security filter clears its per-request SecurityContext.

        String essay=language.equals("ja")?"猫が好きです。":language.equals("zh")?"我喜欢这座城市。":"A raw essay e\u0301 😀 "+language;
        submit(id,seed,essay,"fr");
        var job=jobs.findAllByAttemptId(id).getFirst();
        assertThat(job.getContextJson()).containsEntry("schemaVersion",2).containsEntry("sourceLanguage",language).containsEntry("feedbackLanguage","fr");
        actor.setNativeLanguage("de");users.saveAndFlush(actor);
        admin.updateExamStatus(seed.examId(),false);
        worker.process(job.getId());
        var result=attempts.getAttemptResult(id);
        assertThat(result.getResultSummary().getObjective().getRawScore()).isEqualByComparingTo("1");
        assertThat(result.getResultSummary().getWriting().getTasks().getFirst().getScore()).isEqualByComparingTo("10");
        var task=feedback.getWritingFeedback(id,seed.writingPart()).tasks().getFirst();
        assertThat(task.originalText()).isEqualTo(essay);
        assertThat(task.scoreUnit()).isEqualTo("PRACTICE_0_10");assertThat(task.feedbackLanguage()).isEqualTo("fr");
        assertThat(task.language()).isEqualTo(language);
        assertThat(attempts.getAttemptReview(id,seed.readingPart()).getQuestions().getFirst().getVerdict()).isEqualTo("CORRECT");
        assertThat(images).isNotNull();verifyNoInteractions(images);
    }

    @Test void mockAndInvalidFeedbackDoNotCallProviderOrMutateAnswers()throws Exception{
        var seed=publish("vi");int id=start(seed,TestMode.MOCK_TEST);
        assertThatThrownBy(()->dictionary.lookup(id,new DictionaryLookupV2Request(UUID.randomUUID().toString(),seed.readingPart(),"passage","水","水 a café Việt 日本語","en"))).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        assertThatThrownBy(()->hints.generate(id,new WritingHintsRequest(seed.writingPart(),"essay",UUID.randomUUID().toString(),null,"en"))).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        int initialVersion=attempts.getAttemptWorkspace(id).getVersion();
        var request=new SubmitAttemptRequest(SubmitReason.MANUAL,initialVersion,List.of(answer(seed.writingPart(),"essay","not persisted")),"xx-invalid");
        assertThatThrownBy(()->attempts.submitAttempt(id,request)).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        assertThat(attempts.getAttemptWorkspace(id).getVersion()).isEqualTo(initialVersion);
        verifyNoInteractions(gemini);
    }

    @ParameterizedTest @ValueSource(strings={"", " \u00a0\u0085\u3000"})
    void genericEmptyEssayIsLocalZeroWithoutProviderOrQuota(String raw)throws Exception{
        var seed=publish("ja");int id=start(seed,TestMode.PRACTICE);submit(id,seed,raw,"fr");
        var job=jobs.findAllByAttemptId(id).getFirst();
        assertThat(job.getStatus()).isEqualTo(WritingGradingJobStatus.SUCCEEDED);
        assertThat(job.getQuotaReserved()).isFalse();
        var task=feedback.getWritingFeedback(id,seed.writingPart()).tasks().getFirst();
        assertThat(task.reasonCode()).isEqualTo("EMPTY_ESSAY");assertThat(task.originalText()).isEqualTo(raw);
        assertThat(task.overall()).isEqualByComparingTo("0");assertThat(task.criteria()).isEmpty();
        assertThat(task.schemaVersion()).isEqualTo(2);
        verifyNoInteractions(gemini,images);
    }

    @Test void unavailableHistoricalJobIsNotRegradedWhenMultilingualIsEnabled()throws Exception{
        var seed=publish("vi");int id=start(seed,TestMode.PRACTICE);
        gradingProperties.setMultilingualEnabled(false);
        submit(id,seed,"Bài viết tiếng Việt được giữ nguyên.","fr");
        var oldJob=jobs.findAllByAttemptId(id).getFirst();
        assertThat(oldJob.getStatus()).isEqualTo(WritingGradingJobStatus.UNAVAILABLE);
        var original=mapper.writeValueAsString(oldJob.getContextJson());
        gradingProperties.setMultilingualEnabled(true);
        attempts.getAttemptResult(id);attempts.getAttemptReview(id,seed.writingPart());
        attempts.submitAttempt(id,new SubmitAttemptRequest(SubmitReason.MANUAL,null,null,"de"));
        assertThat(mapper.writeValueAsString(jobs.findById(oldJob.getId()).orElseThrow().getContextJson())).isEqualTo(original);
        assertThat(feedback.getWritingFeedback(id,seed.writingPart()).tasks().getFirst().overall()).isNull();
        verifyNoInteractions(gemini);
    }
}
