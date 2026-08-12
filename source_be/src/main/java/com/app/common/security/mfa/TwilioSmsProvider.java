package com.app.common.security.mfa;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

@Service
@Slf4j
public class TwilioSmsProvider {

    @Value("${twilio.account-sid:dummy_sid}")
    private String accountSid;

    @Value("${twilio.auth-token:dummy_token}")
    private String authToken;

    @Value("${twilio.from-number:+1234567890}")
    private String fromNumber;

    @PostConstruct
    public void init() {
        if (!"dummy_sid".equals(accountSid)) {
            Twilio.init(accountSid, authToken);
        }
    }

    public void sendSms(String toPhoneNumber, String text) {
        log.info("Sending SMS to {}: {}", toPhoneNumber, text);
        if (!"dummy_sid".equals(accountSid)) {
            Message.creator(
                new PhoneNumber(toPhoneNumber),
                new PhoneNumber(fromNumber),
                text
            ).create();
        }
    }
}
