package com.app.common.database.service;

import com.app.common.database.entity.OrderJpaEntity;
import jakarta.persistence.EntityManagerFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.SessionFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BulkOrderImportService {

    private final EntityManagerFactory entityManagerFactory;
    private static final int BATCH_SIZE = 50;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int bulkInsert(List<OrderJpaEntity> orders) {
        var sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);

        try (var session = sessionFactory.openStatelessSession()) {
            var tx = session.beginTransaction();
            try {
                int count = 0;
                for (var order : orders) {
                    session.insert(order);
                    count++;

                    if (count % BATCH_SIZE == 0) {
                        log.debug("Inserted {} records so far", count);
                    }
                }
                tx.commit();
                log.info("Bulk inserted {} orders", count);
                return count;
            } catch (Exception e) {
                tx.rollback();
                throw e;
            }
        }
    }
}
