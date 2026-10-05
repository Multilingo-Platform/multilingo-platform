package com.multilingo.backend.modules.auth.security;

import com.multilingo.backend.modules.auth.entity.User;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;

@AllArgsConstructor
@Getter
public class CustomUserDetails implements UserDetails {
    private final User user;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        if (user.getRole() != null) {
            String roleName = user.getRole().getName();
            if (!roleName.startsWith("ROLE_")) {
                roleName = "ROLE_" + roleName.toUpperCase();
            }
            return Collections.singleton(new SimpleGrantedAuthority(roleName));
        }
        return Collections.emptyList();
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return user.getIsActive() != null ? user.getIsActive() : true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.getIsActive() != null ? user.getIsActive() : true;
    }
}
