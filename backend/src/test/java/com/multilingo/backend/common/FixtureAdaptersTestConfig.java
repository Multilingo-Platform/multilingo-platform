package com.multilingo.backend.common;

import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.adapter.impl.FixtureExamAdapter;
import com.multilingo.backend.modules.testing.adapter.impl.FixtureGradingAdapter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Replaces the database adapters only in tests that explicitly use fixture exams. */
@TestConfiguration
public class FixtureAdaptersTestConfig {

    @Bean(name = "dbExamAdapter")
    @Primary
    ExamAdapter examAdapter(@Qualifier("fixtureExamAdapter") FixtureExamAdapter fixtureExamAdapter) {
        return fixtureExamAdapter;
    }

    @Bean(name = "dbGradingAdapter")
    @Primary
    GradingAdapter gradingAdapter(@Qualifier("fixtureGradingAdapter") FixtureGradingAdapter fixtureGradingAdapter) {
        return fixtureGradingAdapter;
    }
}
