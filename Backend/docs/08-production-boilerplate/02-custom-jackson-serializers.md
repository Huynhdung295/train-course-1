# 💱 Custom Jackson Serializers & Deserializers

> **Category**: Production Boilerplate | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.3+ | **Jackson**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Serialization Problem
Standard Jackson handles basic types perfectly (Strings, Integers, Booleans).
However, enterprise applications often need custom formatting:
- **Money**: Returning `100.50` instead of a complex `Money` object with currency.
- **Enums**: Accepting strings or integers but mapping them to an Enum, or serializing an Enum to its description.
- **Masking**: Masking sensitive data (`1234-5678-9012-3456` → `****-****-****-3456`) before it hits the HTTP response.
- **Dates**: Handling obscure external API date formats.

### @JsonComponent
Spring Boot provides the `@JsonComponent` annotation. It automatically registers your custom `JsonSerializer` or `JsonDeserializer` with the global `ObjectMapper`, saving you from writing configuration classes and `SimpleModule` boilerplate.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[FasterXML/jackson-docs](https://github.com/FasterXML/jackson-docs)** — Official Jackson documentation.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-json</artifactId>
</dependency>
```

---

## 📐 System Design Blueprint

### Complete Custom Serialization Implementation

```java
// ═══════════════════════════════════════════════════
// 1. DATA MASKING (Serializer)
// ═══════════════════════════════════════════════════

// The type we want to serialize differently
public record CreditCardNumber(String value) {}

/**
 * Serializes CreditCardNumber objects by masking all but the last 4 digits.
 * @JsonComponent automatically registers this with Spring's ObjectMapper.
 */
@JsonComponent
public class CreditCardSerializer extends JsonSerializer<CreditCardNumber> {

    @Override
    public void serialize(CreditCardNumber card, JsonGenerator gen, SerializerProvider serializers) 
            throws IOException {
            
        if (card == null || card.value() == null) {
            gen.writeNull();
            return;
        }

        String raw = card.value();
        if (raw.length() < 4) {
            gen.writeString("****");
        } else {
            String masked = "****-****-****-" + raw.substring(raw.length() - 4);
            gen.writeString(masked);
        }
    }
}

// ═══════════════════════════════════════════════════
// 2. ENUM TO OBJECT MAPPING (Serializer & Deserializer)
// ═══════════════════════════════════════════════════

public enum OrderStatus {
    NEW("Newly created order"),
    PROCESSING("Payment received, preparing for shipment"),
    SHIPPED("Handed over to carrier");

    private final String description;
    OrderStatus(String description) { this.description = description; }
    public String getDescription() { return description; }
}

/**
 * Instead of returning "NEW", return {"code": "NEW", "description": "Newly created order"}
 */
@JsonComponent
public class OrderStatusSerializer extends JsonSerializer<OrderStatus> {
    @Override
    public void serialize(OrderStatus status, JsonGenerator gen, SerializerProvider serializers) 
            throws IOException {
        gen.writeStartObject();
        gen.writeStringField("code", status.name());
        gen.writeStringField("description", status.getDescription());
        gen.writeEndObject();
    }
}

/**
 * Allow the client to send either "NEW" or {"code": "NEW"} and still deserialize correctly.
 */
@JsonComponent
public class OrderStatusDeserializer extends JsonDeserializer<OrderStatus> {
    @Override
    public OrderStatus deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        JsonNode node = p.getCodec().readTree(p);
        
        if (node.isTextual()) {
            return OrderStatus.valueOf(node.asText().toUpperCase());
        } else if (node.isObject() && node.has("code")) {
            return OrderStatus.valueOf(node.get("code").asText().toUpperCase());
        }
        
        throw new IllegalArgumentException("Cannot deserialize OrderStatus from " + node);
    }
}

// ═══════════════════════════════════════════════════
// 3. GLOBAL OBJECT MAPPER CONFIGURATION
// ═══════════════════════════════════════════════════

/**
 * Customize the core ObjectMapper settings globally for the entire Spring context.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jsonCustomizer() {
        return builder -> builder
            // Standard formatting
            .featuresToDisable(
                SerializationFeature.WRITE_DATES_AS_TIMESTAMPS,  // Use ISO-8601 strings
                DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES // Don't crash if frontend sends extra fields
            )
            .featuresToEnable(
                MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS // "new" -> OrderStatus.NEW
            )
            // Remove nulls from the response to save bandwidth
            .serializationInclusion(JsonInclude.Include.NON_NULL)
            // Optional: Register JavaTimeModule explicitly (though Spring Boot usually does this)
            .modulesToInstall(new JavaTimeModule());
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Create an endpoint to test Serialization
# @GetMapping("/test") -> return new OrderResponse(new CreditCardNumber("1234567890123456"), OrderStatus.NEW);

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/jackson/test" | ConvertTo-Json -Depth 5

# Expected Output:
# {
#   "creditCard": "****-****-****-3456",
#   "status": {
#       "code": "NEW",
#       "description": "Newly created order"
#   }
# }
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Use `@JsonComponent` over Modules**. Instead of creating a `SimpleModule`, adding your serializers to it, and registering the module with the `ObjectMapper`, `@JsonComponent` does all of that automatically.
2. **Disable `FAIL_ON_UNKNOWN_PROPERTIES`**. In a microservice ecosystem, clients or upstream services will often add new fields to JSON payloads. Your service shouldn't crash if it sees a field it doesn't understand.
3. **Write ISO-8601 Strings for Dates**. Never write dates as epoch timestamps (Longs). They lack timezone context and are unreadable for humans debugging the JSON. Disable `WRITE_DATES_AS_TIMESTAMPS`.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Using `@JsonFormat(pattern="yyyy-MM-dd")` everywhere | Inconsistent date formats across the API. Hard to maintain. | Configure date formats globally via `Jackson2ObjectMapperBuilderCustomizer`. |
| Creating a new `ObjectMapper()` manually in a Service | Manual mappers don't have Spring's default modules (like JavaTimeModule) or your `@JsonComponent`s registered. | Always `@Autowired ObjectMapper mapper`. |
| Returning raw entity classes in the Controller | Exposes sensitive fields (passwords, internal IDs) and ties the API contract to the DB schema. | Always use DTOs for responses. |
