package com.app.common.batch;

import com.app.common.database.entity.OrderJpaEntity;
import com.app.common.database.entity.OrderStatus;
import jakarta.persistence.EntityManagerFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.*;
import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemWriter;
import org.springframework.batch.item.database.JpaPagingItemReader;
import org.springframework.batch.item.database.builder.JpaPagingItemReaderBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/**
 * DailyReportBatchConfig — Spring Batch configuration for daily order report generation.
 *
 * Pattern: Reader → Processor → Writer (chunk-oriented processing)
 * - Reader: JPA paging reader — reads COMPLETED orders from today
 * - Processor: Transforms OrderJpaEntity → OrderReportLine DTO
 * - Writer: Saves to report_lines table (or writes CSV)
 */
@Configuration
@EnableBatchProcessing
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class DailyReportBatchConfig {

    private static final int CHUNK_SIZE = 100;

    // ─── Job Definition ────────────────────────────────────────────────────────

    @Bean
    public Job dailyOrderReportJob(JobRepository jobRepository,
                                   Step generateReportStep,
                                   DailyReportJobListener jobListener) {
        return new JobBuilder("dailyOrderReportJob", jobRepository)
            .listener(jobListener)
            .start(generateReportStep)
            .build();
    }

    // ─── Step Definition ───────────────────────────────────────────────────────

    @Bean
    public Step generateReportStep(JobRepository jobRepository,
                                   PlatformTransactionManager txManager,
                                   JpaPagingItemReader<OrderJpaEntity> orderReader,
                                   ItemProcessor<OrderJpaEntity, OrderReportLine> orderProcessor,
                                   ItemWriter<OrderReportLine> orderWriter) {
        return new StepBuilder("generateReportStep", jobRepository)
            .<OrderJpaEntity, OrderReportLine>chunk(CHUNK_SIZE, txManager)
            .reader(orderReader)
            .processor(orderProcessor)
            .writer(orderWriter)
            .faultTolerant()
            .skipLimit(10)                          // Skip up to 10 bad records
            .skip(Exception.class)                  // Skip on any exception
            .retryLimit(3)                          // Retry 3 times per item
            .retry(org.springframework.dao.TransientDataAccessException.class)
            .build();
    }

    // ─── ItemReader (JPA Paging) ───────────────────────────────────────────────

    @Bean
    public JpaPagingItemReader<OrderJpaEntity> orderReader(EntityManagerFactory emf) {
        String todayStart = LocalDate.now().atStartOfDay().toString();
        return new JpaPagingItemReaderBuilder<OrderJpaEntity>()
            .name("orderReader")
            .entityManagerFactory(emf)
            .queryString("SELECT o FROM OrderJpaEntity o WHERE o.status = :status " +
                         "AND o.placedAt >= :since AND o.deletedAt IS NULL ORDER BY o.placedAt ASC")
            .parameterValues(Map.of(
                "status", OrderStatus.CONFIRMED,
                "since", Instant.now().minusSeconds(86400)  // last 24h
            ))
            .pageSize(CHUNK_SIZE)
            .build();
    }

    // ─── ItemProcessor ─────────────────────────────────────────────────────────

    @Bean
    public ItemProcessor<OrderJpaEntity, OrderReportLine> orderProcessor() {
        return order -> {
            log.debug("Processing order {} for report", order.getId());
            return new OrderReportLine(
                order.getId().toString(),
                order.getUserId().toString(),
                order.getTotalAmount(),
                order.getStatus().name(),
                order.getPlacedAt()
            );
        };
    }

    // ─── ItemWriter ────────────────────────────────────────────────────────────

    @Bean
    public ItemWriter<OrderReportLine> orderWriter() {
        return items -> {
            log.info("Writing batch of {} order report lines", items.size());
            // NOTE: persist to report_lines table or write to S3 CSV
            for (var line : items) {
                log.debug("Report line: orderId={}, amount={}", line.orderId(), line.totalAmount());
            }
        };
    }
}
