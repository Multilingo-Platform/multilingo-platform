package com.multilingo.backend.modules.auth.repository;

import com.multilingo.backend.modules.auth.entity.RefreshToken;
import com.multilingo.backend.modules.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Integer> {
    Optional<RefreshToken> findByToken(String token);
    
    @Modifying
    @Query("UPDATE RefreshToken r SET r.isRevoked = true WHERE r.user = :user")
    int revokeAllUserTokens(User user);
    
    @Modifying
    int deleteByUser(User user);
}
