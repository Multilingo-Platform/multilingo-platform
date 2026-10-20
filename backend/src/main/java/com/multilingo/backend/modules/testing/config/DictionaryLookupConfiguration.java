package com.multilingo.backend.modules.testing.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(DictionaryLookupProperties.class)
public class DictionaryLookupConfiguration { }
