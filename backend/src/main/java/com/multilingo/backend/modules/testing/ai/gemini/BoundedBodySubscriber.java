package com.multilingo.backend.modules.testing.ai.gemini;

import com.multilingo.backend.modules.testing.ai.media.BoundedByteBodySubscriber;

/** Backwards-compatible Gemini facade; the shared subscriber knows no provider. */
public class BoundedBodySubscriber extends BoundedByteBodySubscriber {
    public BoundedBodySubscriber(int maxBytes) {
        super(maxBytes, () -> new GeminiClientException(GeminiClientException.Kind.RESPONSE_TOO_LARGE,
                "Response body exceeds maximum allowed size of " + maxBytes + " bytes"));
    }
}
