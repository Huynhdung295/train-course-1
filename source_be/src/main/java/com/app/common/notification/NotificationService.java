package com.app.common.notification;

/**
 * NotificationService — Abstraction for sending notifications across multiple channels.
 *
 * Supported channels: Email, SMS, Push Notification (WebPush)
 *
 * Design principle: The caller doesn't need to know whether an email is sent via
 * SMTP, AWS SES, or SendGrid — the implementation is swappable per environment.
 */
public interface NotificationService {

    void sendEmail(EmailRequest request);

    void sendSms(SmsRequest request);

    record EmailRequest(
        String to,
        String subject,
        String body,
        boolean isHtml
    ) {
        public static EmailRequest plain(String to, String subject, String body) {
            return new EmailRequest(to, subject, body, false);
        }

        public static EmailRequest html(String to, String subject, String htmlBody) {
            return new EmailRequest(to, subject, htmlBody, true);
        }
    }

    record SmsRequest(
        String to,       // E.164 format: +84901234567
        String message
    ) {}
}
