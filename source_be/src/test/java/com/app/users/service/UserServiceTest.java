package com.app.users.service;

import com.app.common.security.UserDetailsServiceImpl;
import com.app.users.entity.User;
import com.app.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.*;

/**
 * UserServiceTest — Unit tests for UserDetailsServiceImpl.
 * Uses Mockito — no Spring context, no DB needed. Extremely fast.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserDetailsService Tests")
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserDetailsServiceImpl userDetailsService;

    private User mockUser;

    @BeforeEach
    void setUp() {
        mockUser = new User();
        mockUser.setEmail("test@demo.nexus.com");
        mockUser.setPasswordHash("$2a$12$encodedPassword");
        mockUser.setStatus("ACTIVE");
        mockUser.setTenantId("tenant_demo");
    }

    @Test
    @DisplayName("loadUserByUsername: returns SecurityUser for valid email")
    void loadUserByUsername_ValidEmail_ReturnsSecurityUser() {
        given(userRepository.findByEmailAndDeletedFalse("test@demo.nexus.com"))
            .willReturn(Optional.of(mockUser));

        var userDetails = userDetailsService.loadUserByUsername("test@demo.nexus.com");

        assertThat(userDetails).isNotNull();
        assertThat(userDetails.getUsername()).isEqualTo("test@demo.nexus.com");
        assertThat(userDetails.isEnabled()).isTrue();
        assertThat(userDetails.isAccountNonLocked()).isTrue();
    }

    @Test
    @DisplayName("loadUserByUsername: throws UsernameNotFoundException for unknown email")
    void loadUserByUsername_UnknownEmail_ThrowsException() {
        given(userRepository.findByEmailAndDeletedFalse("unknown@example.com"))
            .willReturn(Optional.empty());

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("unknown@example.com"))
            .isInstanceOf(UsernameNotFoundException.class)
            .hasMessageContaining("unknown@example.com");
    }

    @Test
    @DisplayName("loadUserByUsername: locked user account is non-lockable")
    void loadUserByUsername_LockedUser_IsAccountNonLocked_ReturnsFalse() {
        mockUser.setStatus("LOCKED");
        given(userRepository.findByEmailAndDeletedFalse("locked@demo.nexus.com"))
            .willReturn(Optional.of(mockUser));

        var userDetails = userDetailsService.loadUserByUsername("locked@demo.nexus.com");

        assertThat(userDetails.isAccountNonLocked()).isFalse();
    }

    @Test
    @DisplayName("loadUserByUsername: disabled user account")
    void loadUserByUsername_DisabledUser_IsEnabled_ReturnsFalse() {
        mockUser.setStatus("INACTIVE");
        given(userRepository.findByEmailAndDeletedFalse("inactive@demo.nexus.com"))
            .willReturn(Optional.of(mockUser));

        var userDetails = userDetailsService.loadUserByUsername("inactive@demo.nexus.com");

        assertThat(userDetails.isEnabled()).isFalse();
    }
}
