package com.app.users.repository;

import com.app.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Used by UserDetailsServiceImpl — finds active (non-deleted) user by email.
     * The 'deleted = false' condition implements soft-delete filtering.
     */
    Optional<User> findByEmailAndDeletedFalse(String email);

    Optional<User> findByEmail(String email);

    Optional<User> findByIdAndDeletedFalse(UUID id);

    boolean existsByEmail(String email);

    List<User> findByTenantIdAndDeletedFalse(String tenantId);

    @Query("SELECT u FROM User u WHERE u.tenantId = :tenantId AND u.status = 'ACTIVE' AND u.deleted = false")
    List<User> findActiveUsersByTenant(@Param("tenantId") String tenantId);
}
