package com.multilingo.backend.modules.testing.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "testing.dictionary-lookup")
public class DictionaryLookupProperties {
    private boolean enabled = false;
    private long recoveryIntervalMs = 60_000;
}
