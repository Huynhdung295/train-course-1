package com.app.common.notification;

/**
 * NotificationService — Abstraction for sending notifications across multiple channels.
 *
 * Supported channels: Email (SMTP / AWS SES), SMS (Twilio)
 *
 * Design principle: The caller doesn't know whether an email is sent via
 * SMTP, AWS SES, or SendGrid — the implementation is swappable per environment.
 *
 * Implementations:
 *   - {@link SmtpNotificationService} — SMTP for email, Twilio for SMS
 *
 * Usage:
 *   notificationService.sendEmail(EmailRequest.plain("user@example.com", "Subject", "Body"));
 *   notificationService.sendSms(new SmsRequest("+84901234567", "Your OTP is: 123456"));
 */
public interface NotificationService {

    void sendEmail(EmailRequest request);

    void sendSms(SmsRequest request);
}
