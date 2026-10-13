package com.placement.config;

import com.placement.security.CustomUserDetailsService;
import com.placement.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizationRequestRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomUserDetailsService userDetailsService;
    private final JwtAuthFilter jwtAuthFilter;
    private final CustomOAuth2LoginSuccessHandler oauth2SuccessHandler;

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${app.url:http://localhost:3001}")
    private String appUrl;

    /**
     * Password encoder for normal username/password authentication.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * DAO authentication provider for normal login.
     */
    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();

        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());

        return provider;
    }

    /**
     * Authentication manager.
     */
    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {

        return config.getAuthenticationManager();
    }

    /**
     * CORS configuration.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration config = new CorsConfiguration();

        java.util.List<String> patterns = new java.util.ArrayList<>();
        if (allowedOrigins != null && !allowedOrigins.isBlank()) {
            patterns.addAll(java.util.Arrays.stream(allowedOrigins.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList());
        }
        patterns.add("https://*.vercel.app");
        patterns.add("https://*.onrender.com");
        patterns.add("http://localhost:*");

        config.setAllowedOriginPatterns(patterns.stream().distinct().toList());

        config.setAllowedMethods(List.of(
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
        ));

        config.setAllowedHeaders(List.of("*"));

        config.setAllowCredentials(true);

        config.setExposedHeaders(List.of("Authorization", "Content-Disposition"));

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", config);

        return source;
    }

    /**
     * OAuth2 user service.
     *
     * Google:
     *   email is normally returned directly by Google's user-info endpoint.
     *
     * GitHub:
     *   GitHub may return email=null from /user even when the
     *   user:email scope has been granted.
     *
     *   CustomGitHubOAuth2UserService handles that case by calling:
     *
     *   GET https://api.github.com/user/emails
     *
     * and adds the verified primary email to OAuth2User attributes.
     */
    @Bean
    public OAuth2UserService<OAuth2UserRequest, OAuth2User> oauth2UserService() {

        return new CustomOAuth2UserService();
    }

    /**
     * Main Spring Security filter chain.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http) throws Exception {

        String failureRedirect =
                appUrl + "/oauth/callback?error=oauth_failed";

        SimpleUrlAuthenticationFailureHandler failureHandler =
                new SimpleUrlAuthenticationFailureHandler(
                        failureRedirect
                );

        http
                // ---------------------------------------------------------
                // CORS
                // ---------------------------------------------------------
                .cors(cors ->
                        cors.configurationSource(corsConfigurationSource())
                )

                // ---------------------------------------------------------
                // CSRF
                // ---------------------------------------------------------
                .csrf(csrf -> csrf.disable())

                // ---------------------------------------------------------
                // Disable HTTP Basic
                // ---------------------------------------------------------
                .httpBasic(hb -> hb.disable())

                // ---------------------------------------------------------
                // Disable form login
                // ---------------------------------------------------------
                .formLogin(fl -> fl.disable())

                // ---------------------------------------------------------
                // JWT based authentication
                //
                // OAuth2 temporarily requires the authorization request
                // repository below, therefore we explicitly configure it.
                // ---------------------------------------------------------
                .sessionManagement(sm ->
                        sm.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                // ---------------------------------------------------------
                // Authentication failure response for normal API calls
                // ---------------------------------------------------------
                .exceptionHandling(ex ->
                        ex.authenticationEntryPoint((req, res, authEx) -> {

                            res.setStatus(
                                    org.springframework.http.HttpStatus.UNAUTHORIZED.value()
                            );

                            res.setContentType("application/json");

                            String message =
                                    authEx.getMessage() != null
                                            ? authEx.getMessage()
                                            : "Authentication required";

                            res.getWriter().write(
                                    "{\"timestamp\":\""
                                            + java.time.LocalDateTime.now()
                                            + "\","
                                            + "\"status\":401,"
                                            + "\"error\":\"Unauthorized\","
                                            + "\"message\":\""
                                            + message.replace("\"", "\\\"")
                                            + "\"}"
                            );
                        })
                )

                // ---------------------------------------------------------
                // OAuth2 Login
                // ---------------------------------------------------------
                .oauth2Login(oauth2 -> oauth2

                        .successHandler(oauth2SuccessHandler)

                        .failureHandler(failureHandler)

                        .userInfoEndpoint(userInfo ->
                                userInfo.userService(
                                        oauth2UserService()
                                )
                        )

                        .authorizationEndpoint(endpoint ->
                                endpoint.authorizationRequestRepository(
                                        auth2RequestRepo()
                                )
                        )
                )

                // ---------------------------------------------------------
                // Authorization rules
                // ---------------------------------------------------------
                .authorizeHttpRequests(auth -> auth

                        // CORS preflight
                        .requestMatchers(
                                org.springframework.http.HttpMethod.OPTIONS,
                                "/**"
                        ).permitAll()

                        // Public authentication endpoints
                        .requestMatchers(
                                "/api/auth/register",
                                "/api/auth/login",
                                "/api/auth/refresh",
                                "/api/auth/logout",
                                "/api/auth/resend-verification",
                                "/api/auth/verify-email",
                                "/api/auth/complete-registration"
                        ).permitAll()

                        // Admin authentication
                        .requestMatchers(
                                "/api/admin/auth/**"
                        ).permitAll()

                        // H2 console
                        .requestMatchers(
                                "/h2-console/**"
                        ).permitAll()

                        // OAuth2 endpoints
                        .requestMatchers(
                                "/oauth2/**",
                                "/login/oauth2/**"
                        ).permitAll()

                        // OAuth callback
                        .requestMatchers(
                                "/oauth/callback"
                        ).permitAll()

                        // Company Admin authentication
                        .requestMatchers(
                                "/api/company/*/admin/login"
                        ).permitAll()

                        // Public GET APIs
                        .requestMatchers(
                                org.springframework.http.HttpMethod.GET,
                                "/api/roles/**",
                                "/api/questions/**",
                                "/api/coding/problems",
                                "/api/coding/problems/**",
                                "/api/coding/languages",
                                "/api/coding/sql",
                                "/api/coding/dataframe",
                                "/api/technical/questions",
                                "/api/technical/questions/**",
                                "/api/aptitude/questions",
                                "/api/aptitude/questions/**",
                                "/api/questionbank/**",
                                "/api/jobs",
                                "/api/jobs/{id:[0-9]+}"
                        ).permitAll()

                        // Admin APIs
                        .requestMatchers(
                                "/api/admin/**"
                        ).hasAnyRole(
                                "ADMIN"
                        )

                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/api/auth/public").permitAll()
                        .requestMatchers("/ws/**").permitAll()

                        // Everything else requires authentication
                        .anyRequest().authenticated()
                )

                // ---------------------------------------------------------
                // H2 console iframe support
                // ---------------------------------------------------------
                .headers(headers ->
                        headers.frameOptions(
                                frame -> frame.sameOrigin()
                        )
                )

                // ---------------------------------------------------------
                // Authentication provider
                // ---------------------------------------------------------
                .authenticationProvider(
                        authenticationProvider()
                )

                // ---------------------------------------------------------
                // JWT filter
                // ---------------------------------------------------------
                .addFilterBefore(
                        jwtAuthFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    /**
     * Stores the OAuth2 authorization request temporarily during
     * the OAuth redirect flow.
     */
    @Bean
    public AuthorizationRequestRepository<OAuth2AuthorizationRequest>
    auth2RequestRepo() {

        return new HttpSessionOAuth2AuthorizationRequestRepository();
    }
}