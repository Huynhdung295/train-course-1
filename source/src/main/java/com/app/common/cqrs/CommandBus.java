package com.app.common.cqrs;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
public class CommandBus {

    private final ApplicationContext context;

    @SuppressWarnings("all")
    public <R> R dispatch(Command<R> command) {
        String handlerBeanName = StringUtils.uncapitalize(
            command.getClass().getSimpleName().replace("Command", "Handler")
        );
        var handler = (CommandHandler<Command<R>, R>) context.getBean(handlerBeanName);
        return handler.handle(command);
    }
}
