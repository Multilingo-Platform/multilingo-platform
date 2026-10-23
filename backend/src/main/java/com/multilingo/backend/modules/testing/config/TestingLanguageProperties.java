package com.multilingo.backend.modules.testing.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@ConfigurationProperties(prefix = "testing.languages")
public class TestingLanguageProperties {
    private List<String> supported = new ArrayList<>(List.of("en", "vi", "ko", "zh", "ja", "fr", "de", "es"));
}
