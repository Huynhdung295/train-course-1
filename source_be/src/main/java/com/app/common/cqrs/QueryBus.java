package com.app.common.cqrs;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@RequiredArgsConstructor
public class QueryBus {

    private final ApplicationContext context;

    @SuppressWarnings("all")
    public <R> R dispatch(Query<R> query) {
        String handlerBeanName = StringUtils.uncapitalize(
            query.getClass().getSimpleName().replace("Query", "Handler")
        );
        var handler = (QueryHandler<Query<R>, R>) context.getBean(handlerBeanName);
        return handler.handle(query);
    }
}
