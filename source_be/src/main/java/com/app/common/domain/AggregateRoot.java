package com.app.common.domain;

import java.util.Collection;

/**
 * AggregateRoot — Marker interface for DDD Aggregate Roots.
 *
 * An Aggregate Root is the only entry point to the aggregate cluster.
 * External code may only hold a reference to the root, never to inner entities.
 *
 * Extend this to register domain events that will be published
 * by Spring Modulith after the transaction commits.
 *
 * @param <ID> the type of the aggregate's identifier (typically UUID)
 */
public interface AggregateRoot<ID> {

    ID getId();

    /**
     * Returns all domain events raised during this aggregate's lifecycle.
     * Spring Modulith will publish these after the transaction commits.
     */
    Collection<?> domainEvents();

    /**
     * Called by the framework after domain events have been published.
     * Clears the internal event list to prevent double-publishing.
     */
    void clearDomainEvents();
}
