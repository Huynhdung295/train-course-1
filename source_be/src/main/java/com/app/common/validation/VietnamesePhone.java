package com.app.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.regex.Pattern;

/**
 * @VietnamesePhone — Custom validation annotation for Vietnamese phone numbers.
 *
 * Valid formats:
 *   - 0901234567    (10 digits, starts with 0)
 *   - +84901234567  (E.164 international format)
 *
 * Usage on DTO fields:
 *   @VietnamesePhone
 *   private String phoneNumber;
 */
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = VietnamesePhone.Validator.class)
public @interface VietnamesePhone {
    String message() default "Invalid Vietnamese phone number format. Expected: 0901234567 or +84901234567";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<VietnamesePhone, String> {
        private static final Pattern VN_PHONE = Pattern.compile(
            "^(\\+84|0)(3[2-9]|5[6-9]|7[06-9]|8[0-9]|9[0-9])\\d{7}$"
        );

        @Override
        public boolean isValid(String value, ConstraintValidatorContext ctx) {
            if (value == null || value.isBlank()) return true; // Use @NotBlank separately
            return VN_PHONE.matcher(value.trim()).matches();
        }
    }
}
