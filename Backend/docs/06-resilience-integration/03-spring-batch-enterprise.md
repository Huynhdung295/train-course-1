# 🚜 Spring Batch for Enterprise Data Processing

> **Category**: Resilience & Integration | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+ | **Spring Batch**: 5.1+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Why Spring Batch?
When you need to process millions of records (ETL, night-end billing, migrations), simple `for` loops fail due to memory exhaustion (OOM), transaction timeouts, and lack of restartability.
Spring Batch provides:
- **Chunk-Based Processing**: Read 1000 rows, Process 1000 rows, Write 1000 rows, Commit. Repeat. Keeps memory footprint small.
- **Restartability**: If job fails at row 500,000, restarting it resumes at 500,001 (using persistent metadata tables).
- **Fault Tolerance**: Skip failed records, retry transient failures, and log bad data without failing the whole batch.
- **Parallel Processing**: Multi-threading, async processing, and remote partitioning across a cluster.

### Spring Batch 5.x Major Changes (Spring Boot 3)
- Requires Java 17+.
- `JobBuilderFactory` and `StepBuilderFactory` are deprecated/removed. Use `JobBuilder` and `StepBuilder` with explicit `JobRepository` and `PlatformTransactionManager`.
- `@EnableBatchProcessing` is **no longer required/recommended** in Spring Boot. Boot auto-configures everything.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-batch](https://github.com/spring-projects/spring-batch)** — Core repository.
- **[spring-projects/spring-batch/tree/main/spring-batch-samples](https://github.com/spring-projects/spring-batch/tree/main/spring-batch-samples)** — Official Enterprise Patterns.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-batch</artifactId>
</dependency>

<!-- Necessary for writing batch metadata to your DB -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration

```yaml
spring:
  batch:
    jdbc:
      initialize-schema: always  # Creates the BATCH_JOB_* metadata tables automatically
    job:
      enabled: false             # Prevents jobs from auto-running on application startup (crucial for web apps)
```

---

## 📐 System Design Blueprint

### Complete Chunk-Based Job Architecture

```java
// ═══════════════════════════════════════════════════
// 1. DOMAIN & DTOs
// ═══════════════════════════════════════════════════

public record ImportRecord(String accountId, BigDecimal amount, String status) {}
public record ProcessedRecord(String accountId, BigDecimal amount, BigDecimal tax) {}

// ═══════════════════════════════════════════════════
// 2. BATCH JOB CONFIGURATION (Spring Batch 5 Style)
// ═══════════════════════════════════════════════════

@Configuration
@RequiredArgsConstructor
@Slf4j
public class BillingBatchConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final DataSource dataSource;

    // --- 1. READER: Read from DB in pages (stateless, thread-safe) ---
    @Bean
    @StepScope // Instantiated per step execution; allows late binding of job parameters
    public JdbcPagingItemReader<ImportRecord> billingReader(
            @Value("#{jobParameters['billingDate']}") String billingDate) {
            
        var queryProvider = new SqlPagingQueryProviderFactoryBean();
        queryProvider.setDataSource(dataSource);
        queryProvider.setSelectClause("SELECT account_id, amount, status");
        queryProvider.setFromClause("FROM raw_billing_data");
        queryProvider.setWhereClause("WHERE billing_date = :billingDate AND status = 'PENDING'");
        queryProvider.setSortKey("account_id");

        return new JdbcPagingItemReaderBuilder<ImportRecord>()
                .name("billingReader")
                .dataSource(dataSource)
                .queryProvider(queryProvider.getObject())
                .parameterValues(Map.of("billingDate", billingDate))
                .pageSize(1000)
                .rowMapper((rs, rowNum) -> new ImportRecord(
                        rs.getString("account_id"),
                        rs.getBigDecimal("amount"),
                        rs.getString("status")
                ))
                .build();
    }

    // --- 2. PROCESSOR: Apply business logic (1 in, 1 out) ---
    @Bean
    public ItemProcessor<ImportRecord, ProcessedRecord> billingProcessor() {
        return item -> {
            // Filter out bad data (Returning null skips the item)
            if (item.amount().compareTo(BigDecimal.ZERO) <= 0) {
                log.warn("Skipping negative/zero billing amount for account {}", item.accountId());
                return null; 
            }
            
            // Apply business logic (e.g., calculate tax)
            var tax = item.amount().multiply(new BigDecimal("0.15"));
            return new ProcessedRecord(item.accountId(), item.amount(), tax);
        };
    }

    // --- 3. WRITER: Bulk insert/update ---
    @Bean
    public JdbcBatchItemWriter<ProcessedRecord> billingWriter() {
        return new JdbcBatchItemWriterBuilder<ProcessedRecord>()
                .dataSource(dataSource)
                .sql("INSERT INTO final_invoices (account_id, amount, tax, created_at) " +
                     "VALUES (:accountId, :amount, :tax, NOW())")
                .beanMapped()
                .build();
    }

    // --- 4. STEP CONSTRUCTION with Fault Tolerance ---
    @Bean
    public Step processBillingStep(
            JdbcPagingItemReader<ImportRecord> reader,
            ItemProcessor<ImportRecord, ProcessedRecord> processor,
            JdbcBatchItemWriter<ProcessedRecord> writer) {
            
        return new StepBuilder("processBillingStep", jobRepository)
                .<ImportRecord, ProcessedRecord>chunk(1000, transactionManager)
                .reader(reader)
                .processor(processor)
                .writer(writer)
                
                // Fault Tolerance: Skip parsing errors up to 100 times
                .faultTolerant()
                .skip(IllegalArgumentException.class)
                .skipLimit(100)
                
                // Retry DB deadlocks 3 times
                .retry(CannotAcquireLockException.class)
                .retryLimit(3)
                
                // Use Virtual Threads for concurrent chunk processing!
                .taskExecutor(new TaskExecutorAdapter(Executors.newVirtualThreadPerTaskExecutor()))
                .throttleLimit(20) // Max 20 concurrent chunks
                
                .build();
    }

    // --- 5. JOB CONSTRUCTION ---
    @Bean
    public Job dailyBillingJob(Step processBillingStep) {
        return new JobBuilder("dailyBillingJob", jobRepository)
                .incrementer(new RunIdIncrementer()) // Allows running the same job multiple times
                .start(processBillingStep)
                .listener(new JobExecutionListener() {
                    @Override
                    public void afterJob(JobExecution jobExecution) {
                        if (jobExecution.getStatus() == BatchStatus.COMPLETED) {
                            log.info("JOB SUCCESS! Time: {}", jobExecution.getEndTime());
                        } else if (jobExecution.getStatus() == BatchStatus.FAILED) {
                            log.error("JOB FAILED! Triggering PagerDuty...");
                        }
                    }
                })
                .build();
    }
}

// ═══════════════════════════════════════════════════
// 3. LAUNCHING THE JOB (Via REST Controller or Scheduler)
// ═══════════════════════════════════════════════════

@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
@Slf4j
public class JobLauncherController {

    private final JobLauncher jobLauncher;
    private final Job dailyBillingJob;

    @PostMapping("/billing")
    public ResponseEntity<String> launchBillingJob(@RequestParam String date) {
        try {
            var jobParameters = new JobParametersBuilder()
                    .addString("billingDate", date)
                    .addLong("run.id", System.currentTimeMillis()) // Ensure uniqueness
                    .toJobParameters();

            // jobLauncher.run is SYNCHRONOUS by default. 
            // In production, configure JobLauncher with an Async TaskExecutor so this HTTP call doesn't block.
            var execution = jobLauncher.run(dailyBillingJob, jobParameters);
            
            return ResponseEntity.accepted().body("Job started with ID: " + execution.getId());
            
        } catch (JobExecutionAlreadyRunningException | JobRestartException |
                 JobInstanceAlreadyCompleteException | JobParametersInvalidException e) {
            log.error("Job launch failed", e);
            return ResponseEntity.status(500).body(e.getMessage());
        }
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Trigger the batch job via API
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/jobs/billing?date=2023-10-01"

# Check Job execution status in the DB directly (Postgres)
docker exec postgres psql -U app -d app_db -c "SELECT job_execution_id, status, exit_code FROM batch_job_execution ORDER BY create_time DESC LIMIT 5;"

# Check Step execution details (Read count, write count, skip count)
docker exec postgres psql -U app -d app_db -c "SELECT step_name, read_count, write_count, commit_count, skip_count FROM batch_step_execution WHERE job_execution_id = (SELECT MAX(job_execution_id) FROM batch_job_execution);"
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Disable Auto-Run**: `spring.batch.job.enabled=false`. Jobs should be triggered by a scheduler (Quartz/Airflow) or API, not automatically every time the Spring Boot JVM restarts.
2. **Use Paging/Cursor Readers**: Never load the entire dataset into memory. Use `JdbcPagingItemReader` (stateless, thread-safe, best for parallel steps) or `JdbcCursorItemReader` (fastest for single-thread).
3. **Tasklet vs Chunk**: Use `Tasklet` for one-off operations (file cleanup, running a single SQL stored proc). Use `Chunk` for processing data row-by-row.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Using `@EnableBatchProcessing` in Boot 3 | Disables Spring Boot's excellent auto-configuration (no metadata tables init, no default transaction manager). | Remove it. Let Boot handle config. |
| Making HTTP calls in the `Processor` without caching | Processing 1 million rows = 1 million HTTP calls = System collapse. | Use local cache, or pre-fetch data in the `Reader`. |
| Modifying the underlying data sorting the `PagingReader` | If you process `WHERE status=PENDING` and update it to `PROCESSED`, the offset paging skips rows! | Page by static criteria (ID, Date) or use a cursor. |
