package com.multilingo.backend.modules.auth.mapper;

import com.multilingo.backend.modules.auth.dto.request.UserCreationRequest;
import com.multilingo.backend.modules.auth.dto.request.UserUpdateRequest;
import com.multilingo.backend.modules.auth.dto.response.UserResponse;
import com.multilingo.backend.modules.auth.entity.User;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring")
public interface UserMapper {
    @Mapping(target = "role", ignore = true)
    @Mapping(target = "nativeLanguage", ignore = true)
    @Mapping(target = "targetLanguage", ignore = true)
    @Mapping(target = "subscriptionTier", ignore = true)
    @Mapping(target = "premiumExpiresAt", ignore = true)
    @Mapping(target = "isActive", ignore = true)
    @Mapping(target = "googleId", ignore = true)
    @Mapping(target = "lastLoginAt", ignore = true)
    @Mapping(target = "lastLoginIp", ignore = true)
    User toUser(UserCreationRequest request);

    @Mapping(source = "role.name", target = "role")
    UserResponse toUserResponse(User user);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "role", ignore = true)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "email", ignore = true)
    @Mapping(target = "nativeLanguage", ignore = true)
    @Mapping(target = "targetLanguage", ignore = true)
    @Mapping(target = "subscriptionTier", ignore = true)
    @Mapping(target = "premiumExpiresAt", ignore = true)
    @Mapping(target = "isActive", ignore = true)
    @Mapping(target = "googleId", ignore = true)
    @Mapping(target = "lastLoginAt", ignore = true)
    @Mapping(target = "lastLoginIp", ignore = true)
    void updateUser(@MappingTarget User user, UserUpdateRequest request);
}
