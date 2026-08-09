# Dockerfile — Multi-stage build for Spring Boot application
# Stage 1: Build | Stage 2: Runtime (minimal JRE image)

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /workspace/app

# Cache Maven dependencies first (only re-runs when pom.xml changes)
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

# Copy source and build (skip tests — run in CI pipeline separately)
COPY src src
RUN ./mvnw package -DskipTests -B

# Extract layered jar for optimal Docker layer caching
RUN java -Djarmode=layertools -jar target/*.jar extract

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

# Security: run as non-root user
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy extracted layers in dependency order
# (dependencies change rarely → cached; app code changes often → separate layer)
COPY --from=builder /workspace/app/dependencies/ ./
COPY --from=builder /workspace/app/spring-boot-loader/ ./
COPY --from=builder /workspace/app/snapshot-dependencies/ ./
COPY --from=builder /workspace/app/application/ ./

# JVM tuning for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS org.springframework.boot.loader.launch.JarLauncher"]
