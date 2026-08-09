package com.app.common.database.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

@Embeddable
@Getter
@Setter
public class ShippingAddressEmbeddable {

    @Column(name = "shipping_street")
    private String street;

    @Column(name = "shipping_city")
    private String city;

    @Column(name = "shipping_state")
    private String state;

    @Column(name = "shipping_postal", length = 20)
    private String postalCode;

    @Column(name = "shipping_country", length = 2)
    private String countryCode;
}
