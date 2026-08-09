package com.app.common.database.repository;

import com.app.common.database.dto.OrderSummary;
import com.app.common.database.entity.OrderJpaEntity;
import com.app.common.database.entity.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderJpaRepository extends JpaRepository<OrderJpaEntity, UUID>,
        JpaSpecificationExecutor<OrderJpaEntity> {

    @Query("SELECT new com.app.common.database.dto.OrderSummary(o.id, o.status, o.totalAmount, o.placedAt) " +
           "FROM OrderJpaEntity o WHERE o.userId = :userId AND o.deletedAt IS NULL " +
           "ORDER BY o.placedAt DESC")
    Page<OrderSummary> findSummariesByUserId(@Param("userId") UUID userId, Pageable pageable);

    @EntityGraph(attributePaths = {"lines"})
    Optional<OrderJpaEntity> findWithLinesById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM OrderJpaEntity o WHERE o.id = :id")
    Optional<OrderJpaEntity> findByIdForUpdate(@Param("id") UUID id);

    @Modifying
    @Query("UPDATE OrderJpaEntity o SET o.status = :status, o.updatedAt = CURRENT_TIMESTAMP, o.version = o.version + 1 " +
           "WHERE o.id IN :ids AND o.status = :currentStatus")
    int updateStatusBatch(@Param("ids") List<UUID> ids,
                          @Param("status") OrderStatus newStatus,
                          @Param("currentStatus") OrderStatus currentStatus);

    @Query(value = "SELECT * FROM orders o WHERE o.status = :status AND o.deleted_at IS NULL FOR UPDATE SKIP LOCKED", nativeQuery = true)
    List<OrderJpaEntity> findAvailableForProcessing(@Param("status") String status);

    boolean existsByUserIdAndStatus(UUID userId, OrderStatus status);

    long countByStatusAndCreatedAtAfter(OrderStatus status, Instant since);
}
