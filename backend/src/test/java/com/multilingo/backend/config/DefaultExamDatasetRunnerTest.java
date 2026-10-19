package com.multilingo.backend.config;

import com.multilingo.backend.modules.exam.service.DefaultExamDatasetService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class DefaultExamDatasetRunnerTest {
    @Test
    void resolvesOnlyRegisteredBundleNamesAndPassesExplicitPublishGate() throws Exception {
        DefaultExamDatasetService service = mock(DefaultExamDatasetService.class);
        ApplicationArguments arguments = mock(ApplicationArguments.class);

        new DefaultExamDatasetRunner(service, true,
                "cambridge-ielts-20-test-1,ets-2024-test-1").run(arguments);

        var captor = org.mockito.ArgumentCaptor.forClass(Resource[].class);
        verify(service).seedClasspath(captor.capture(), eq(true));
        assertThat(captor.getValue()).extracting(Resource::getFilename)
                .containsExactly("cambridge-ielts-20-test-1.v2.json", "ets-2024-test-1.v2.json");
        assertThat(captor.getValue()).allMatch(resource -> resource instanceof ClassPathResource);
    }

    @Test
    void canSeedAndPublishOnlyTheSelectedToeicBundle() throws Exception {
        DefaultExamDatasetService service = mock(DefaultExamDatasetService.class);

        new DefaultExamDatasetRunner(service, true, "ets-2024-test-1")
                .run(mock(ApplicationArguments.class));

        var captor = org.mockito.ArgumentCaptor.forClass(Resource[].class);
        verify(service).seedClasspath(captor.capture(), eq(true));
        assertThat(captor.getValue()).extracting(Resource::getFilename)
                .containsExactly("ets-2024-test-1.v2.json");
    }

    @Test
    void rejectsAnyDatasetOutsideTheCodeOwnedAllowlist() {
        DefaultExamDatasetService service = mock(DefaultExamDatasetService.class);

        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
                new DefaultExamDatasetRunner(service, true, "../../etc/passwd")
                        .run(mock(ApplicationArguments.class)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Unknown default exam dataset key.");
        org.mockito.Mockito.verifyNoInteractions(service);
    }
}
