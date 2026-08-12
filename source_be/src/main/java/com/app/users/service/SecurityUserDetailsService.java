package com.app.users.service;

/**
 * @deprecated Replaced by {@link com.app.common.security.UserDetailsServiceImpl}.
 *
 * This class was the original UserDetailsService implementation.
 * It has been superseded by UserDetailsServiceImpl in the common/security package
 * which includes soft-delete filtering, proper logging, and @Transactional support.
 *
 * DO NOT add @Service or @Component annotation here — the bean is already
 * registered via UserDetailsServiceImpl in com.app.common.security.
 */
@SuppressWarnings("unused")
public class SecurityUserDetailsService {
    // Intentionally empty — see com.app.common.security.UserDetailsServiceImpl
}

