package com.app.common.notification;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * SmtpNotificationService — Implementation of NotificationService.
 *
 * Email: Sent via JavaMailSender (SMTP / AWS SES compatible)
 * SMS:   Sent via Twilio REST API
 *
 * Both are @Async to avoid blocking the request thread.
 */
@Service
@Slf4j
public class SmtpNotificationService implements NotificationService {

    private final JavaMailSender mailSender;

    @Value("${app.notification.email.from:noreply@nexus.com}")
    private String fromEmail;

    @Value("${app.notification.sms.twilio-account-sid:#{null}}")
    private String twilioAccountSid;

    @Value("${app.notification.sms.twilio-auth-token:#{null}}")
    private String twilioAuthToken;

    @Value("${app.notification.sms.twilio-from-number:#{null}}")
    private String twilioFromNumber;

    public SmtpNotificationService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    @Async("generalAsyncExecutor")
    public void sendEmail(EmailRequest request) {
        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(request.to());
            helper.setSubject(request.subject());
            helper.setText(request.body(), request.isHtml());
            mailSender.send(message);
            log.info("Email sent to: {}", request.to());
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", request.to(), e.getMessage(), e);
        }
    }

    @Override
    @Async("generalAsyncExecutor")
    public void sendSms(SmsRequest request) {
        if (twilioAccountSid == null || twilioAccountSid.isBlank()) {
            log.warn("Twilio not configured. Skipping SMS to: {}", request.to());
            return;
        }
        try {
            Twilio.init(twilioAccountSid, twilioAuthToken);
            Message.creator(
                new PhoneNumber(request.to()),
                new PhoneNumber(twilioFromNumber),
                request.message()
            ).create();
            log.info("SMS sent to: {}", request.to());
        } catch (Exception e) {
            log.error("Failed to send SMS to {}: {}", request.to(), e.getMessage(), e);
        }
    }
}
