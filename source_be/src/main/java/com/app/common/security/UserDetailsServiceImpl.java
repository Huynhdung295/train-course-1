package com.app.common.security;

import com.app.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UserDetailsServiceImpl — Bridges Spring Security with the domain User entity.
 *
 * Called by Spring Security during authentication to load the user from the database.
 * Wraps the domain User in a SecurityUser adapter that implements UserDetails.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        log.debug("Loading user by email: {}", email);
        return userRepository.findByEmailAndDeletedFalse(email)
            .map(SecurityUser::new)
            .orElseThrow(() -> {
                log.warn("User not found with email: {}", email);
                return new UsernameNotFoundException("User not found: " + email);
            });
    }
}
