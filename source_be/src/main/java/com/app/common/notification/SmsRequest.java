package com.app.common.notification;

/**
 * SmsRequest — Value object for SMS notifications.
 * Phone number must be in E.164 format: +84901234567
 */
public record SmsRequest(
    String to,      // E.164 format: +84901234567
    String message
) {}
