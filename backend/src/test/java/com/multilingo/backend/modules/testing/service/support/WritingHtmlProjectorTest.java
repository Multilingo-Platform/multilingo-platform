package com.multilingo.backend.modules.testing.service.support;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WritingHtmlProjectorTest {
    @Test
    void preservesAdjacentInlineTextAndSeparatesBlockContent() {
        var projection = WritingHtmlProjector.project("<p>The rate rose from <b>1</b>0% to 25%.</p><p>un<strong>employment</strong><br>Next line.</p>");
        assertThat(projection.text()).isEqualTo("The rate rose from 10% to 25%. unemployment Next line.");
    }

    @Test
    void projectsHtmlTextAndExtractsImageReferenceWithoutFetching() {
        var projection = WritingHtmlProjector.project("<p>Describe the chart <img src='https://cdn.example.test/chart.png' alt='chart'> carefully.</p>");
        assertThat(projection.text()).isEqualTo("Describe the chart carefully.");
        assertThat(projection.imageUrls()).containsExactly("https://cdn.example.test/chart.png");
        assertThat(projection.invalidImageReference()).isFalse();
    }

    @Test
    void rejectsAnImageTagWithNoSourceAndLeavesPlainTextAlone() {
        assertThat(WritingHtmlProjector.project("<p>Look here <img alt='chart'></p>").invalidImageReference()).isTrue();
        assertThat(WritingHtmlProjector.project("A plain task prompt").text()).isEqualTo("A plain task prompt");
    }
}
