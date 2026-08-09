package com.app.common.aop;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * @Auditable — Custom AOP annotation to record audit trail for sensitive operations.
 *
 * Usage:
 *   @Auditable(action = "ORDER_PLACE", resourceType = "Order")
 *   public Order placeOrder(PlaceOrderCommand cmd) { ... }
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {

    /** Human-readable action name (e.g. "ORDER_PLACE", "USER_DELETE") */
    String action();

    /** Resource type being acted upon (e.g. "Order", "User") */
    String resourceType() default "";

    /** SpEL expression for resource ID (e.g. "#cmd.orderId.value()") */
    String resourceIdExpression() default "";
}
