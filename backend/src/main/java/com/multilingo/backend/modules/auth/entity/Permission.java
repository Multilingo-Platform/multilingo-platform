package com.multilingo.backend.modules.auth.entity;

import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;

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
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Permission extends BaseEntity {

    @Column(name = "action_code", length = 100, unique = true, nullable = false)
    String actionCode;

    @Column(name = "module", length = 50, nullable = false)
    String module;

    @Column(name = "description", columnDefinition = "text")
    String description;
}
