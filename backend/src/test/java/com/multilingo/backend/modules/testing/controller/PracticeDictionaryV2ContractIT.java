package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.modules.testing.dto.request.DictionaryLookupV2Request;
import com.multilingo.backend.modules.testing.dto.response.DictionaryLookupV2Response;
import com.multilingo.backend.modules.testing.service.PracticeDictionaryV2Service;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "testing.dictionary-lookup.enabled=false")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PracticeDictionaryV2ContractIT {
    @Autowired private MockMvc mvc;
    @MockBean private PracticeDictionaryV2Service service;

    @Test
    @WithAnonymousUser
    void anonymousRequestIsRejectedBeforeTheDictionaryService() throws Exception {
        mvc.perform(post("/api/v2/attempts/42/dictionary-lookups")
                        .contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    @WithMockUser(username = "21", roles = "USER")
    void authenticatedRequestUsesTheContractAndDoesNotCacheTheDefinition() throws Exception {
        String requestId = UUID.randomUUID().toString();
        when(service.lookup(eq(42), any())).thenReturn(new DictionaryLookupV2Response(requestId, 42, 7,
                "group-7", "elms", "The elms grow beside the river.",
                new DictionaryLookupV2Response.DictionaryDefinitionV2(
                        2, "en", "vi", "cây du", null, "noun", "The elms grow here.", "Cây du mọc ở đây.")));
        mvc.perform(post("/api/v2/attempts/42/dictionary-lookups")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBodyWith(requestId)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.definition.meaning").value("cây du"))
                .andExpect(jsonPath("$.data.definition.schemaVersion").value(2))
                .andExpect(jsonPath("$.data.requestId").value(requestId));
        verify(service).lookup(eq(42), any(DictionaryLookupV2Request.class));
    }

    private static String validBody() { return validBodyWith(UUID.randomUUID().toString()); }
    private static String validBodyWith(String id) {
        return "{\"requestId\":\"" + id + "\",\"partId\":7,\"documentId\":\"group-7\","
                + "\"selectedText\":\"elms\",\"contextText\":\"The elms grow beside the river.\",\"meaningLanguage\":\"vi\"}";
    }
}
