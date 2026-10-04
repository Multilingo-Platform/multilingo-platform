package com.multilingo.backend.modules.auth.repository;

import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"})
public class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager entityManager;

    @Test
    public void testSaveUserAndFindByEmail() {
        Role role = new Role();
        role.setName("STUDENT");
        role.setDescription("Student Role");
        role.setCreatedAt(java.time.Instant.now());
        role.setUpdatedAt(java.time.Instant.now());
        role = entityManager.persist(role);

        User user = new User();
        user.setEmail("test@example.com");
        user.setPasswordHash("hashedpass");
        user.setRole(role);
        user.setCreatedAt(java.time.Instant.now());
        user.setUpdatedAt(java.time.Instant.now());
        userRepository.save(user);

        Optional<User> found = userRepository.findByEmail("test@example.com");
        assertTrue(found.isPresent());
        assertEquals("test@example.com", found.get().getEmail());
    }
}
