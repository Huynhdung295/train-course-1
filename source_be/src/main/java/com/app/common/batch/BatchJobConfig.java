package com.app.common.batch;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.launch.support.RunIdIncrementer;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemReader;
import org.springframework.batch.item.ItemWriter;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * BatchJobConfig — Spring Batch configuration for scheduled heavy processing jobs.
 *
 * Jobs defined here:
 * - dailyRevenueReportJob: Aggregates and persists daily revenue per tenant (runs at 1 AM)
 * - dataExportJob:         Exports tenant data to S3 for backup/analytics
 *
 * HOW TO RUN A JOB MANUALLY:
 *   POST /actuator/batch/jobs/dailyRevenueReportJob/start
 *
 * HOW TO SCHEDULE:
 *   Add @Scheduled in a separate BatchJobScheduler bean.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class BatchJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    /**
     * Template for creating a new Batch Job.
     * Replace <T> and <R> with your actual read/write types.
     *
     * Example: dailyRevenueReportJob reads Order aggregations and writes RevenueReport records.
     */
    public <T, R> Job createBatchJob(
            String jobName,
            ItemReader<T> reader,
            ItemProcessor<T, R> processor,
            ItemWriter<R> writer,
            int chunkSize) {

        Step step = new StepBuilder(jobName + "-step", jobRepository)
            .<T, R>chunk(chunkSize, transactionManager)
            .reader(reader)
            .processor(processor)
            .writer(writer)
            .faultTolerant()
            .retryLimit(3)
            .retry(Exception.class)
            .skipLimit(100)
            .skip(Exception.class)
            .build();

        return new JobBuilder(jobName, jobRepository)
            .incrementer(new RunIdIncrementer())
            .start(step)
            .build();
    }
}
