package com.app.common.serialization;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * MoneySerializer — Custom Jackson serializer for monetary BigDecimal values.
 *
 * WHY THIS MATTERS: Using Java `double` or `float` for money is catastrophically wrong
 * due to floating point precision errors (0.1 + 0.2 = 0.30000000000000004).
 *
 * This serializer ensures:
 * 1. Money is ALWAYS serialized as a string with exactly 2 decimal places: "1234.50"
 *    (prevents JSON numeric precision loss in JavaScript where Number is IEEE 754 double)
 * 2. Money is ALWAYS deserialized via BigDecimal, never double/float
 *
 * Wire format: "1234567.89" (string)  — not 1234567.89 (number)
 *
 * Register via JacksonConfig: objectMapper.registerModule(moneyModule())
 */
@Configuration
public class MoneySerializer {

    @Bean
    public SimpleModule moneyModule() {
        var module = new SimpleModule("MoneyModule");
        module.addSerializer(BigDecimal.class, new MoneyJsonSerializer());
        module.addDeserializer(BigDecimal.class, new MoneyJsonDeserializer());
        return module;
    }

    public static class MoneyJsonSerializer extends JsonSerializer<BigDecimal> {
        @Override
        public void serialize(BigDecimal value, JsonGenerator gen, SerializerProvider provider)
                throws IOException {
            if (value == null) {
                gen.writeNull();
            } else {
                // Always 2 decimal places, as string to prevent JS precision loss
                gen.writeString(value.setScale(2, RoundingMode.HALF_UP).toPlainString());
            }
        }
    }

    public static class MoneyJsonDeserializer extends JsonDeserializer<BigDecimal> {
        @Override
        public BigDecimal deserialize(JsonParser p, DeserializationContext ctx)
                throws IOException {
            String text = p.getText();
            if (text == null || text.isBlank()) return BigDecimal.ZERO;
            return new BigDecimal(text.trim()).setScale(2, RoundingMode.HALF_UP);
        }
    }
}
