package com.app.common.batch;

import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobExecutionListener;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * DailyReportJobListener — Log job start/end and send alerts on failure.
 */
@Component
@Slf4j
@SuppressWarnings("all")
public class DailyReportJobListener implements JobExecutionListener {

    @Override
    public void beforeJob(JobExecution jobExecution) {
        log.info("Starting batch job: {} | jobId={}", 
            jobExecution.getJobInstance().getJobName(), jobExecution.getId());
    }

    @Override
    public void afterJob(JobExecution jobExecution) {
        long durationMs = Duration.between(
            jobExecution.getStartTime(), jobExecution.getEndTime()).toMillis();

        if (jobExecution.getStatus().isUnsuccessful()) {
            log.error("Batch job FAILED: {} | duration={}ms | failures={}",
                jobExecution.getJobInstance().getJobName(),
                durationMs,
                jobExecution.getAllFailureExceptions().size());
            // NOTE: Send alert to monitoring system / Slack
        } else {
            log.info("Batch job COMPLETED: {} | duration={}ms | writeCount={}",
                jobExecution.getJobInstance().getJobName(),
                durationMs,
                jobExecution.getStepExecutions().stream()
                    .mapToLong(s -> s.getWriteCount()).sum());
        }
    }
}
