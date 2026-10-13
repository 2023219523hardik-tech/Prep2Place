package com.placement.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        // No JWT -> continue normally.
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7).trim();

        // Empty token.
        if (token.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {

            // Refresh tokens must never authenticate normal API requests.
            if (jwtUtil.isTokenParseable(token)
                    && !jwtUtil.isRefreshToken(token)
                    && SecurityContextHolder.getContext().getAuthentication() == null) {

                String email = jwtUtil.extractEmail(token);

                if (email != null && !email.isBlank()) {

                    UserDetails userDetails =
                            userDetailsService.loadUserByUsername(email);

                    if (jwtUtil.isTokenValid(token, userDetails.getUsername())) {

                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(
                                        userDetails,
                                        null,
                                        userDetails.getAuthorities()
                                );

                        authentication.setDetails(
                                new WebAuthenticationDetailsSource()
                                        .buildDetails(request)
                        );

                        SecurityContextHolder
                                .getContext()
                                .setAuthentication(authentication);
                    }
                }
            }

        } catch (Exception ex) {

            // Invalid JWT must not break OAuth2/browser requests.
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }
}