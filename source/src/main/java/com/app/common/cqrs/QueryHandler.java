package com.app.common.cqrs;

public interface QueryHandler<Q extends Query<R>, R> {
    R handle(Q query);
}
