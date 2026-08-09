package com.app.orders.domain;

import java.util.Objects;

public record Address(
    String street,
    String city,
    String state,
    String postalCode,
    String countryCode
) {
    public Address {
        Objects.requireNonNull(street, "Street is required");
        Objects.requireNonNull(city, "City is required");
        Objects.requireNonNull(countryCode, "Country code is required");
        if (countryCode.length() != 2) {
            throw new IllegalArgumentException("Country code must be ISO 3166-1 alpha-2");
        }
    }

    public String format() {
        return "%s, %s, %s %s, %s".formatted(street, city, state, postalCode, countryCode);
    }
}
