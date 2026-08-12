package com.app.common.serialization;

import com.app.common.domain.Money;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import org.springframework.boot.jackson.JsonComponent;

import java.io.IOException;
import java.math.BigDecimal;

/**
 * MoneySerializer and MoneyDeserializer — Custom Jackson serialization for Money value object.
 *
 * Serializes Money as: {"amount": 100.00, "currency": "USD"}
 * Deserializes from the same format.
 *
 * @JsonComponent registers both inner classes automatically via Spring Boot.
 */
@JsonComponent
public class MoneyJsonConverter {

    public static class Serializer extends StdSerializer<Money> {

        public Serializer() {
            super(Money.class);
        }

        @Override
        public void serialize(Money money, JsonGenerator gen, SerializerProvider provider)
                throws IOException {
            gen.writeStartObject();
            gen.writeNumberField("amount", money.amount());
            gen.writeStringField("currency", money.currency());
            gen.writeEndObject();
        }
    }

    public static class Deserializer extends StdDeserializer<Money> {

        public Deserializer() {
            super(Money.class);
        }

        @Override
        public Money deserialize(JsonParser p, DeserializationContext ctx) throws IOException {
            com.fasterxml.jackson.databind.JsonNode node = p.getCodec().readTree(p);
            BigDecimal amount = new BigDecimal(node.get("amount").asText());
            String currency = node.has("currency") ? node.get("currency").asText() : "USD";
            return new Money(amount, currency);
        }
    }
}
