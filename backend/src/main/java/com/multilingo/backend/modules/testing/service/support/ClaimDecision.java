package com.multilingo.backend.modules.testing.service.support;

import java.util.Objects;

/**
 * Result of a claim attempt by {@link WritingGradingTransactionCoordinator}.
 */
public sealed interface ClaimDecision {

    record Granted(Claim claim) implements ClaimDecision {
        public Granted {
            Objects.requireNonNull(claim, "claim must not be null");
        }
    }

    record Rejected(String reason) implements ClaimDecision {
        public Rejected {
            Objects.requireNonNull(reason, "reason must not be null");
        }
    }

    record Waiting(String reason) implements ClaimDecision {
        public Waiting {
            Objects.requireNonNull(reason, "reason must not be null");
        }
    }

    default boolean isGranted() {
        return this instanceof Granted;
    }
}
