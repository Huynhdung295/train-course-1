package com.app.orders.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.*;

/**
 * MoneyTest — Unit tests for monetary BigDecimal handling.
 * Verifies correct rounding, scale, and zero value behavior.
 */
@DisplayName("Money (BigDecimal) Domain Tests")
class MoneyTest {

    @Test
    @DisplayName("BigDecimal addition preserves correct scale")
    void bigDecimalAddition_PreservesScale() {
        BigDecimal price1 = new BigDecimal("1234.50");
        BigDecimal price2 = new BigDecimal("500.00");
        BigDecimal result = price1.add(price2);

        assertThat(result).isEqualByComparingTo(new BigDecimal("1734.50"));
        assertThat(result.scale()).isEqualTo(2);
    }

    @Test
    @DisplayName("BigDecimal avoids floating point error unlike double")
    void bigDecimal_AvoidsFPError() {
        // Classic double bug: 0.1 + 0.2 != 0.3 with double
        double doubleResult = 0.1 + 0.2;
        assertThat(doubleResult).isNotEqualTo(0.3); // This PASSES — demonstrating the bug

        // BigDecimal correctly computes 0.1 + 0.2 = 0.3
        BigDecimal bdResult = new BigDecimal("0.1").add(new BigDecimal("0.2"));
        assertThat(bdResult).isEqualByComparingTo(new BigDecimal("0.3"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"99999.99", "0.01", "1234567.89", "0.00"})
    @DisplayName("BigDecimal handles valid monetary values")
    void bigDecimal_HandlesValidMonetaryValues(String amount) {
        BigDecimal money = new BigDecimal(amount);
        assertThat(money).isNotNull();
        assertThat(money.scale()).isLessThanOrEqualTo(2);
    }

    @Test
    @DisplayName("Discount calculation rounds correctly")
    void discountCalculation_RoundsCorrectly() {
        BigDecimal price = new BigDecimal("100.00");
        BigDecimal discountPercent = new BigDecimal("15"); // 15%
        BigDecimal discount = price.multiply(discountPercent)
            .divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP);
        BigDecimal finalPrice = price.subtract(discount);

        assertThat(discount).isEqualByComparingTo(new BigDecimal("15.00"));
        assertThat(finalPrice).isEqualByComparingTo(new BigDecimal("85.00"));
    }
}
