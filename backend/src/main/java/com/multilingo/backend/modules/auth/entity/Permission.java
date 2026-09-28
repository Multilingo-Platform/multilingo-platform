package com.multilingo.backend.modules.auth.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "permissions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Permission extends BaseEntity {

    @Column(name = "action_code", length = 100, unique = true, nullable = false)
    private String actionCode;

    @Column(name = "module", length = 50, nullable = false)
    private String module;

    @Column(name = "description", columnDefinition = "text")
    private String description;
}
