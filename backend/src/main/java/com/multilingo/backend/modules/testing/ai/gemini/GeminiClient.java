package com.multilingo.backend.modules.testing.ai.gemini;

/**
 * Internal backend client interface for interacting with the Google Gemini API.
 */
public interface GeminiClient {

    /**
     * Executes a single generation request against the Gemini API.
     *
     * @param request the validated generation request
     * @return the normalized generation result
     * @throws GeminiClientException on transport, timeout, authentication, or provider rejection
     */
    GeminiGenerationResult generate(GeminiGenerationRequest request);
}
