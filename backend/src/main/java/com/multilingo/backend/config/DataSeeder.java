package com.multilingo.backend.config;

import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.entity.enums.RoleName;
import com.multilingo.backend.modules.auth.repository.RoleRepository;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        log.info("Checking and seeding initial data...");

        // 1. Seed Roles
        Role adminRole = roleRepository.findByName(RoleName.ADMIN.name())
                .orElseGet(() -> {
                    Role role = Role.builder()
                            .name(RoleName.ADMIN.name())
                            .description("Administrator Role")
                            .build();
                    return roleRepository.save(role);
                });

        Role userRole = roleRepository.findByName(RoleName.USER.name())
                .orElseGet(() -> {
                    Role role = Role.builder()
                            .name(RoleName.USER.name())
                            .description("Standard User Role")
                            .build();
                    return roleRepository.save(role);
                });

        // 2. Seed Admin User
        if (!userRepository.existsByEmail("admin@multilingo.com")) {
            User admin = User.builder()
                    .email("admin@multilingo.com")
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .fullName("Super Admin")
                    .role(adminRole)
                    .isActive(true)
                    .build();
            userRepository.save(admin);
            log.info("Admin user created successfully: admin@multilingo.com / admin123");
        } else {
            log.info("Admin user already exists.");
        }
    }
}
