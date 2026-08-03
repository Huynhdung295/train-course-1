# 🌐 RestClient & WebClient in Spring 6

> **Category**: Resilience & Integration | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.2+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Evolution of Spring HTTP Clients
1. **`RestTemplate` (Legacy)**: Synchronous, blocking. Deprecated in spirit; in maintenance mode.
2. **`WebClient` (Reactive)**: Non-blocking, reactive (Project Reactor). Requires `spring-webflux`. Great for high concurrency, but has a steep learning curve.
3. **`RestClient` (Modern - Spring 3.2+)**: A modern, fluent Java API over HTTP libraries. Synchronous, but when combined with Java 21 Virtual Threads, it provides the performance of `WebClient` with the simplicity of `RestTemplate`.

### HTTP Client Engines
`RestClient` is just an API wrapper. Under the hood, you must choose an engine (ClientHttpRequestFactory):
- `JdkClientHttpRequestFactory` (Java 11+ `java.net.http.HttpClient` - Recommended)
- `HttpComponentsClientHttpRequestFactory` (Apache HttpClient 5)
- `ReactorClientHttpConnector` (Netty)

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-framework RestClient](https://docs.spring.io/spring-framework/reference/integration/rest-clients.html)** — Official Documentation.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```
*Note: `RestClient` is included in `spring-web`. No additional dependencies needed.*

---

## ⚙️ Production Configuration

```yaml
app:
  clients:
    inventory-service:
      base-url: http://inventory-svc:8080
      connect-timeout: 2000ms
      read-timeout: 5000ms
```

---

## 📐 System Design Blueprint

### Complete RestClient Configuration & Usage

```java
// ═══════════════════════════════════════════════════
// 1. REST CLIENT CONFIGURATION & FACTORY
// ═══════════════════════════════════════════════════

@Configuration
public class RestClientConfig {

    /**
     * Define the underlying HTTP Client Engine.
     * We use Java's native HttpClient (available since Java 11).
     * It natively supports Virtual Threads and HTTP/2.
     */
    @Bean
    public ClientHttpRequestFactory clientHttpRequestFactory() {
        var httpClient = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_2)
            .connectTimeout(Duration.ofSeconds(2))
            // .executor(Executors.newVirtualThreadPerTaskExecutor()) // If you want manual VT control
            .build();
            
        var factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(5));
        return factory;
    }

    /**
     * Interceptor for logging requests and injecting authorization headers.
     */
    @Bean
    public ClientHttpRequestInterceptor loggingInterceptor() {
        return (request, body, execution) -> {
            // Pre-request (Modify headers, Log)
            request.getHeaders().add("X-Request-Source", "OrderService");
            request.getHeaders().add("Authorization", getBearerToken());
            
            // Execute
            var response = execution.execute(request, body);
            
            // Post-request (Log response status)
            if (response.getStatusCode().is4xxClientError()) {
                // Log warning
            }
            return response;
        };
    }

    /**
     * Build specific RestClients for specific downstream services.
     */
    @Bean
    public RestClient inventoryRestClient(
            RestClient.Builder builder,
            ClientHttpRequestFactory requestFactory,
            ClientHttpRequestInterceptor loggingInterceptor,
            @Value("${app.clients.inventory-service.base-url}") String baseUrl) {
            
        return builder
            .requestFactory(requestFactory)
            .baseUrl(baseUrl)
            .requestInterceptor(loggingInterceptor)
            .defaultHeader("Accept", "application/json")
            .build();
    }
}

// ═══════════════════════════════════════════════════
// 2. USING RESTCLIENT (Fluent API)
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryClient {

    // Inject the specific configured client
    private final RestClient inventoryRestClient;

    /**
     * Standard GET request with error handling.
     */
    public InventoryResponse getInventory(String productId) {
        return inventoryRestClient.get()
            .uri("/api/v1/inventory/{id}", productId)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                throw new InventoryNotFoundException(productId);
            })
            .onStatus(HttpStatusCode::is5xxServerError, (request, response) -> {
                throw new DownstreamServiceException("Inventory Service is down");
            })
            .body(InventoryResponse.class); // Automatically deserializes JSON
    }

    /**
     * POST request sending JSON and expecting a specific return type.
     */
    public ReservationResult reserveStock(ReservationRequest requestBody) {
        return inventoryRestClient.post()
            .uri("/api/v1/inventory/reserve")
            .contentType(MediaType.APPLICATION_JSON)
            .body(requestBody)
            .retrieve()
            .body(ReservationResult.class);
    }
    
    /**
     * Advanced: Exchange (Gives you full access to the raw ClientHttpResponse).
     * Useful when you need to inspect headers before reading the body.
     */
    public String getETagForProduct(String productId) {
        return inventoryRestClient.head()
            .uri("/api/v1/inventory/{id}", productId)
            .exchange((request, response) -> {
                if (response.getStatusCode().is2xxSuccessful()) {
                    return response.getHeaders().getFirst(HttpHeaders.ETAG);
                }
                return null;
            });
    }
}

// ═══════════════════════════════════════════════════
// 3. DECLARATIVE HTTP CLIENTS (HTTP Interfaces - Spring 3.0+)
// ═══════════════════════════════════════════════════
// Similar to Feign/Retrofit, but native to Spring!

// 1. Define the Interface
public interface RemotePricingService {
    
    @GetExchange("/api/v1/pricing/{productId}")
    PricingDto getPrice(@PathVariable("productId") String productId);
    
    @PostExchange("/api/v1/pricing/bulk")
    List<PricingDto> getBulkPrices(@RequestBody List<String> productIds);
}

// 2. Configure the Factory
@Configuration
public class HttpInterfaceConfig {

    @Bean
    public RemotePricingService remotePricingService(RestClient.Builder builder) {
        // Build the underlying RestClient
        var restClient = builder.baseUrl("http://pricing-svc:8080").build();
        
        // Wrap it in an HttpServiceProxyFactory
        var adapter = RestClientAdapter.create(restClient);
        var factory = HttpServiceProxyFactory.builderFor(adapter).build();
        
        // Generate the implementation dynamically!
        return factory.createClient(RemotePricingService.class);
    }
}
```

---

## 🧪 Verification Commands

```powershell
# In a testing environment, mock the downstream server using WireMock

# Start WireMock standalone Docker container
docker run -it --rm -p 8081:8080 --name wiremock wiremock/wiremock:latest

# Configure WireMock to return a stub response
$stub = @{
    request = @{ method = "GET"; url = "/api/v1/inventory/prod-1" }
    response = @{ status = 200; headers = @{ "Content-Type" = "application/json" }; body = '{"stock": 42}' }
} | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:8081/__admin/mappings" -ContentType "application/json" -Body $stub

# Now update your application.yml to point inventory-service to http://localhost:8081
# Test your RestClient code!
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Use `RestClient` over `RestTemplate`** for all new Spring Boot 3.2+ synchronous code.
2. **Use HTTP Interfaces (`@GetExchange`)** to keep your integration code clean and declarative, effectively replacing Spring Cloud OpenFeign.
3. **Always configure timeouts**. The default JDK HttpClient has infinite timeouts. A slow downstream service will exhaust your thread pool.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Using `WebClient.block()` in WebMVC | Adds reactive library bloat just to use a modern client, blocking threads anyway. | Use `RestClient` for synchronous paradigms. |
| Failing to handle `is4xx` / `is5xx` | Default behavior throws a generic `RestClientResponseException`. Hard to distinguish business errors from network errors. | Use `.onStatus()` to map to specific domain exceptions. |
| Re-instantiating `RestClient` per request | Wastes memory and TCP connection pool setups. | Define `RestClient` as a `@Bean` and inject it. |
