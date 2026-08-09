package com.app.common.notification;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    @GetMapping("/stream")
    public SseEmitter streamSseMvc() {
        SseEmitter emitter = new SseEmitter();
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                for (int i = 0; i < 5; i++) {
                    emitter.send(SseEmitter.event().name("message").data("Event " + i));
                    Thread.sleep(1000);
                }
                emitter.complete();
            } catch (Exception ex) {
                emitter.completeWithError(ex);
            }
        });
        return emitter;
    }
}
