package com.app.common.filter;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class RateLimitFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        // Mock Rate Limiting (e.g., using Bucket4j)
        boolean isAllowed = true; 
        
        if (isAllowed) {
            chain.doFilter(request, response);
        } else {
            ((HttpServletResponse) response).setStatus(429);
            response.getWriter().write("Too Many Requests");
        }
    }
}
