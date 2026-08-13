package com.app.common.notification;

/**
 * EmailRequest — Value object for email notifications.
 * Supports both plain text and HTML emails.
 *
 * Usage:
 *   EmailRequest.plain("user@example.com", "Welcome!", "Hello!")
 *   EmailRequest.html("user@example.com", "Order Confirmed", "<h1>...</h1>")
 */
public record EmailRequest(
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
