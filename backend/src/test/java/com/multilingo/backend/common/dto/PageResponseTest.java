package com.multilingo.backend.common.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PageResponseTest {

    @Test
    @DisplayName("PageResponse.from(page) should correctly map Spring Page properties")
    void shouldConvertSpringPageToPageResponse() {
        List<String> items = List.of("Item 1", "Item 2", "Item 3");
        Page<String> page = new PageImpl<>(items, PageRequest.of(0, 10), 3);

        PageResponse<String> response = PageResponse.from(page);

        assertThat(response.getItems()).containsExactly("Item 1", "Item 2", "Item 3");
        assertThat(response.getPage()).isEqualTo(0);
        assertThat(response.getSize()).isEqualTo(10);
        assertThat(response.getTotalElements()).isEqualTo(3L);
        assertThat(response.getTotalPages()).isEqualTo(1);
        assertThat(response.isLast()).isTrue();
    }
}
