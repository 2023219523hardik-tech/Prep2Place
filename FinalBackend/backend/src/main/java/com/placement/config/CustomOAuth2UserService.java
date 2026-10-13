package com.placement.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class CustomOAuth2UserService
        implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final DefaultOAuth2UserService delegate =
            new DefaultOAuth2UserService();

    private final RestTemplate restTemplate =
            new RestTemplate();

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest)
            throws OAuth2AuthenticationException {

        OAuth2User oauthUser = delegate.loadUser(userRequest);

        String registrationId = userRequest
                .getClientRegistration()
                .getRegistrationId();

        log.debug(
                "OAuth2 user loaded: provider={}, attributes={}",
                registrationId,
                oauthUser.getAttributes()
        );

        // Google already returns email directly.
        if (!"github".equalsIgnoreCase(registrationId)) {
            return oauthUser;
        }

        // GitHub can return email=null from /user.
        // Therefore fetch /user/emails.
        String email = extractGitHubEmail(userRequest);

        if (email == null || email.isBlank()) {
                log.warn("GitHub did not provide a verified email for account="+ oauthUser.getAttribute("id"));

            return oauthUser;
        }

        // Copy GitHub attributes.
        Map<String, Object> attributes =
                new HashMap<>(oauthUser.getAttributes());

        // Add the resolved email.
        attributes.put("email", email);

        log.info(
                "GitHub verified email resolved: accountId={} email={}",
                oauthUser.getAttribute("id"),
                email
        );

        return new DefaultOAuth2User(
                oauthUser.getAuthorities(),
                attributes,
                "id"
        );
    }

    /**
     * Fetch GitHub user's email addresses.
     *
     * Endpoint:
     * GET https://api.github.com/user/emails
     *
     * Priority:
     * 1. Primary + verified
     * 2. Any verified email
     * 3. Primary email
     */
    private String extractGitHubEmail(
            OAuth2UserRequest userRequest) {

        try {

            String accessToken =
                    userRequest.getAccessToken().getTokenValue();

            HttpHeaders headers = new HttpHeaders();

            headers.setBearerAuth(accessToken);

            headers.setAccept(
                    List.of(MediaType.APPLICATION_JSON)
            );

            RequestEntity<Void> request =
                    new RequestEntity<>(
                            headers,
                            HttpMethod.GET,
                            URI.create(
                                    "https://api.github.com/user/emails"
                            )
                    );

            ResponseEntity<List<Map<String, Object>>> response =
                    restTemplate.exchange(
                            request,
                            new ParameterizedTypeReference<
                                    List<Map<String, Object>>>() {
                            }
                    );

            if (!response.getStatusCode().is2xxSuccessful()
                    || response.getBody() == null) {

                log.warn(
                        "GitHub /user/emails returned status={}",
                        response.getStatusCode()
                );

                return null;
            }

            List<Map<String, Object>> emails =
                    response.getBody();

            // =========================================================
            // 1. PRIMARY + VERIFIED
            // =========================================================

            for (Map<String, Object> entry : emails) {

                if (isTrue(entry.get("primary"))
                        && isTrue(entry.get("verified"))) {

                    String email = getEmail(entry);

                    if (email != null) {
                        return email;
                    }
                }
            }

            // =========================================================
            // 2. ANY VERIFIED EMAIL
            // =========================================================

            for (Map<String, Object> entry : emails) {

                if (isTrue(entry.get("verified"))) {

                    String email = getEmail(entry);

                    if (email != null) {
                        return email;
                    }
                }
            }

            // =========================================================
            // 3. PRIMARY EMAIL
            // =========================================================

            for (Map<String, Object> entry : emails) {

                if (isTrue(entry.get("primary"))) {

                    String email = getEmail(entry);

                    if (email != null) {
                        return email;
                    }
                }
            }

            return null;

        } catch (Exception e) {

            log.error(
                    "Failed to retrieve GitHub email: {}",
                    e.getMessage(),
                    e
            );

            return null;
        }
    }

    /**
     * Safely check a GitHub boolean attribute.
     */
    private boolean isTrue(Object value) {
        return Boolean.TRUE.equals(value);
    }

    /**
     * Extract email from GitHub response.
     */
    private String getEmail(
            Map<String, Object> entry) {

        Object value = entry.get("email");

        if (value == null) {
            return null;
        }

        String email = value.toString().trim();

        return email.isBlank()
                ? null
                : email;
    }
}