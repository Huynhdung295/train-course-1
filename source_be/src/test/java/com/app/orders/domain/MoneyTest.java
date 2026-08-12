package com.app.orders.domain;

import com.app.common.domain.Money;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.*;

/**
 * MoneyTest — Unit tests for Money value object.
 * Tests: construction, arithmetic, equality, validation.
 */
@DisplayName("Money Value Object")
class MoneyTest {

    @Nested
    @DisplayName("Construction")
    class ConstructionTests {

        @Test
        @DisplayName("should create Money with valid amount and currency")
        void shouldCreateWithValidAmountAndCurrency() {
            var money = new Money(new BigDecimal("100.00"), "USD");
            assertThat(money.amount()).isEqualByComparingTo("100.00");
            assertThat(money.currency()).isEqualTo("USD");
        }

        @Test
        @DisplayName("should throw when amount is negative")
        void shouldThrowWhenNegativeAmount() {
            assertThatThrownBy(() -> new Money(new BigDecimal("-1"), "USD"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("negative");
        }

        @Test
        @DisplayName("should throw when currency is blank")
        void shouldThrowWhenCurrencyBlank() {
            assertThatThrownBy(() -> new Money(BigDecimal.TEN, ""))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("Arithmetic")
    class ArithmeticTests {

        @Test
        @DisplayName("add should return sum of two Money values")
        void addShouldReturnSum() {
            var a = new Money(new BigDecimal("100.00"), "USD");
            var b = new Money(new BigDecimal("50.00"), "USD");
            var result = a.add(b);
            assertThat(result.amount()).isEqualByComparingTo("150.00");
        }

        @Test
        @DisplayName("add should throw when currencies differ")
        void addShouldThrowWhenCurrenciesDiffer() {
            var a = new Money(new BigDecimal("100.00"), "USD");
            var b = new Money(new BigDecimal("50.00"), "EUR");
            assertThatThrownBy(() -> a.add(b))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("currency");
        }

        @Test
        @DisplayName("multiply should scale amount correctly")
        void multiplyShouldScaleAmount() {
            var price = new Money(new BigDecimal("25.00"), "USD");
            var result = price.multiply(3);
            assertThat(result.amount()).isEqualByComparingTo("75.00");
        }
    }

    @Nested
    @DisplayName("Equality")
    class EqualityTests {

        @Test
        @DisplayName("two Money with same amount and currency should be equal")
        void shouldBeEqual() {
            var a = new Money(new BigDecimal("100.00"), "USD");
            var b = new Money(new BigDecimal("100.00"), "USD");
            assertThat(a).isEqualTo(b);
        }

        @Test
        @DisplayName("two Money with different currency should not be equal")
        void shouldNotBeEqualWithDifferentCurrency() {
            var a = new Money(new BigDecimal("100.00"), "USD");
            var b = new Money(new BigDecimal("100.00"), "EUR");
            assertThat(a).isNotEqualTo(b);
        }
    }
}
