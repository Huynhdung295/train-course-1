package com.app.common.outbox;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEventEntity, UUID> {

    @Query("SELECT e FROM OutboxEventEntity e WHERE e.published = false ORDER BY e.createdAt ASC LIMIT :limit")
    List<OutboxEventEntity> findUnpublished(@Param("limit") int limit);
}
