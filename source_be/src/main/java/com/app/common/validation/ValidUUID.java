package com.app.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.UUID;

/**
 * @ValidUUID — Validates that a String field contains a properly formatted UUID v4.
 *
 * Usage:
 *   @ValidUUID
 *   private String orderId;
 */
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidUUID.Validator.class)
public @interface ValidUUID {
    String message() default "Invalid UUID format";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidUUID, String> {
        @Override
        public boolean isValid(String value, ConstraintValidatorContext ctx) {
            if (value == null || value.isBlank()) return true;
            try {
                UUID.fromString(value);
                return true;
            } catch (IllegalArgumentException e) {
                return false;
            }
        }
    }
}
