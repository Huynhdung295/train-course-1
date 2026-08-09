package com.app.common.serialization;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import org.springframework.boot.jackson.JsonComponent;

import java.io.IOException;
import java.time.Instant;
import java.time.format.DateTimeFormatter;

/**
 * InstantJsonConverter — Custom Jackson Instant serializer.
 *
 * Serializes Instant as ISO-8601 string: "2024-01-01T00:00:00Z"
 * (avoids serializing as epoch seconds by default)
 */
@JsonComponent
public class InstantJsonConverter {

    public static class Serializer extends StdSerializer<Instant> {

        private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_INSTANT;

        public Serializer() {
            super(Instant.class);
        }

        @Override
        public void serialize(Instant instant, JsonGenerator gen, SerializerProvider provider)
                throws IOException {
            gen.writeString(FORMATTER.format(instant));
        }
    }

    public static class Deserializer extends StdDeserializer<Instant> {

        public Deserializer() {
            super(Instant.class);
        }

        @Override
        public Instant deserialize(JsonParser p, DeserializationContext ctx) throws IOException {
            return Instant.parse(p.getText());
        }
    }
}
