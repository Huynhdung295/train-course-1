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
 * @ValidUUID — Custom Jakarta validation constraint for UUID strings.
 *
 * Usage: @ValidUUID String orderId
 */
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidUUID.Validator.class)
public @interface ValidUUID {

    String message() default "Invalid UUID format";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    /** If true, null values are considered valid (use @NotNull separately to require) */
    boolean allowNull() default true;

    class Validator implements ConstraintValidator<ValidUUID, String> {

        private boolean allowNull;

        @Override
        public void initialize(ValidUUID annotation) {
            this.allowNull = annotation.allowNull();
        }

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (value == null) return allowNull;
            try {
                UUID.fromString(value);
                return true;
            } catch (IllegalArgumentException e) {
                return false;
            }
        }
    }
}
