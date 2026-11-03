package com.multilingo.backend.modules.testing.dto.request;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import java.io.IOException;

/** Field-local token validation; do not let Jackson truncate or coerce learner time limits. */
public final class StrictTimeLimitDeserializer extends StdDeserializer<Integer> {
    public StrictTimeLimitDeserializer() {
        super(Integer.class);
    }

    @Override
    public Integer deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (!parser.hasToken(JsonToken.VALUE_NUMBER_INT)) {
            context.reportInputMismatch(Integer.class, "timeLimitMinutes must be a JSON integer");
        }
        return parser.getIntValue();
    }
}
