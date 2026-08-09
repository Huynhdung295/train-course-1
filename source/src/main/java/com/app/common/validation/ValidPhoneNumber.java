package com.app.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * @ValidPhoneNumber — Custom Jakarta constraint for E.164 phone number format.
 *
 * Usage: @ValidPhoneNumber String phoneNumber
 */
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidPhoneNumber.Validator.class)
public @interface ValidPhoneNumber {

    String message() default "Phone number must be in E.164 format (e.g. +84912345678)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidPhoneNumber, String> {

        private static final java.util.regex.Pattern E164_PATTERN =
            java.util.regex.Pattern.compile("^\\+[1-9]\\d{1,14}$");

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (value == null || value.isBlank()) return true; // Use @NotBlank to require
            return E164_PATTERN.matcher(value).matches();
        }
    }
}
