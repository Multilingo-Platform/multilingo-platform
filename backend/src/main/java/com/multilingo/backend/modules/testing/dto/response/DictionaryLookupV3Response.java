package com.multilingo.backend.modules.testing.dto.response;

import com.multilingo.backend.modules.testing.dto.request.WorkspaceTextSource;

/**
 * Authoritative response for Dictionary Lookup API V3.
 * Includes complete source identity, frozen native language in definition, and NATIVE_PROFILE_V1 policy.
 */
public record DictionaryLookupV3Response(
        String requestId,
        Integer attemptId,
        Integer partId,
        WorkspaceTextSource source,
        String selectedText,
        String sourceContext,
        String policyVersion,
        DictionaryLookupV2Response.DictionaryDefinitionV2 definition
) {
    public static final String CURRENT_POLICY_VERSION = "NATIVE_PROFILE_V1";

    @Override
    public String toString() {
        return "DictionaryLookupV3Response[requestId=" + requestId + ", attemptId=" + attemptId
                + ", partId=" + partId + ", source=" + (source == null ? null : source.sourceKey())
                + ", policyVersion=" + policyVersion + ", content=<redacted>]";
    }
}
