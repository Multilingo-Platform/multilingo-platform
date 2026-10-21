package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV2Response;
import com.multilingo.backend.modules.testing.exception.DictionaryLookupRetryAfterException;
import com.multilingo.backend.modules.testing.service.PracticeDictionaryV2Service;
import com.multilingo.backend.modules.testing.service.support.DictionaryLookupV2RequestValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PracticeDictionaryV2ControllerIT {
    private PracticeDictionaryV2Service service;
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        service = mock(PracticeDictionaryV2Service.class);
        mvc = MockMvcBuilders.standaloneSetup(new PracticeDictionaryV2Controller(
                service, new DictionaryLookupV2RequestValidator(new LearningLanguageCatalog()))).build();
    }

    @Test
    void acceptedLookupReturnsNoStoreAndValidatedDefinition() throws Exception {
        String id = UUID.randomUUID().toString();
        when(service.lookup(eq(42), any())).thenReturn(new DictionaryLookupV2Response(id, 42, 4, "g1", "elms",
                "The elms grow here.", new DictionaryLookupV2Response.DictionaryDefinitionV2(
                        1, "en", "vi", "cây du", null, "noun", "Elms grow.", "Cây du mọc.")));

        mvc.perform(post("/api/v2/attempts/42/dictionary-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestId\":\"%s\",\"partId\":4,\"documentId\":\"g1\",\"selectedText\":\"elms\",\"contextText\":\"The elms grow here.\",\"meaningLanguage\":\"vi\"}".formatted(id)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.definition.meaning").value("cây du"))
                .andExpect(jsonPath("$.data.definition.meaningLanguage").value("vi"));
        verify(service).lookup(eq(42), any());
    }

    @Test
    void invalidPathAndUnknownBodyFieldAreRejectedWithNoStore() throws Exception {
        mvc.perform(post("/api/v2/attempts/42x/dictionary-lookups").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnprocessableEntity()).andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(post("/api/v2/attempts/42/dictionary-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestId\":\"%s\",\"partId\":4,\"documentId\":\"g1\",\"selectedText\":\"elms\",\"contextText\":\"The elms grow.\",\"meaningLanguage\":\"vi\",\"unknownProp\":\"A\"}".formatted(UUID.randomUUID())))
                .andExpect(status().isUnprocessableEntity()).andExpect(header().string("Cache-Control", "no-store"));
        verifyNoInteractions(service);
    }

    @Test
    void cooldownResponseHasRetryAfterAndDoesNotExposeExceptionMessage() throws Exception {
        String id = UUID.randomUUID().toString();
        when(service.lookup(eq(42), any())).thenThrow(new DictionaryLookupRetryAfterException(
                ErrorCode.DICTIONARY_LOOKUP_RATE_LIMITED, 2));
        mvc.perform(post("/api/v2/attempts/42/dictionary-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requestId\":\"%s\",\"partId\":4,\"documentId\":\"g1\",\"selectedText\":\"elms\",\"contextText\":\"The elms grow.\",\"meaningLanguage\":\"vi\"}".formatted(id)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("Retry-After", "2"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("raw"))));
    }
}
