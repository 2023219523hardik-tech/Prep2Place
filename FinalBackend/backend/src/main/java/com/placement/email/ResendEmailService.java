package com.placement.email;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResendEmailService implements EmailService {

    private static final String RESEND_API_URL =
            "https://api.resend.com/emails";

    private final RestTemplate restTemplate;
    
    @Value("${app.email.from:onboarding@resend.dev}")
    private String emailFrom;

    @Value("${app.email.enabled:true}")
    private boolean emailEnabled;

    @Value("${app.email.resend-api-key:}")
    private String resendApiKey;

    @Override
    public void sendVerificationEmail(
            String toEmail,
            String token,
            String appUrl
    ) {

        if (!emailEnabled) {
            log.info("Email sending is disabled.");
            return;
        }

        if (resendApiKey == null || resendApiKey.isBlank()) {
            log.error("Resend API key is not configured.");
            throw new IllegalStateException(
                    "Resend API key is not configured"
            );
        }

        if (toEmail == null || toEmail.isBlank()) {
            throw new IllegalArgumentException(
                    "Recipient email cannot be empty"
            );
        }

        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException(
                    "Verification token cannot be empty"
            );
        }

        if (appUrl == null || appUrl.isBlank()) {
            throw new IllegalArgumentException(
                    "Application URL cannot be empty"
            );
        }

        String encodedToken = URLEncoder.encode(
                token,
                StandardCharsets.UTF_8
        );

        String verificationLink =
                appUrl.replaceAll("/$", "")
                        + "/verify-email?token="
                        + encodedToken;

        String htmlBody = buildHtmlBody(verificationLink);
        String textBody = buildTextBody(verificationLink);

        ResendSendRequest request =
                ResendSendRequest.builder()
                        .from(emailFrom)
                        .to(List.of(toEmail))
                        .subject("Verify your email for Prep2Place")
                        .html(htmlBody)
                        .text(textBody)
                        .build();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(resendApiKey);

        HttpEntity<ResendSendRequest> entity =
                new HttpEntity<>(request, headers);

        try {

            ResponseEntity<ResendSendResponse> response =
                    restTemplate.exchange(
                            RESEND_API_URL,
                            HttpMethod.POST,
                            entity,
                            ResendSendResponse.class
                    );

            if (response.getStatusCode().is2xxSuccessful()) {

                String messageId =
                        response.getBody() != null
                                ? response.getBody().getId()
                                : "unknown";

                log.info(
                        "Verification email sent successfully to {}. Resend ID={}",
                        maskEmail(toEmail),
                        messageId
                );

                return;
            }

            log.error(
                    "Resend email failed. status={}, recipient={}",
                    response.getStatusCode(),
                    maskEmail(toEmail)
            );

            throw new RuntimeException(
                    "Email provider returned "
                            + response.getStatusCode()
            );

        } catch (RestClientException e) {

            log.error(
                    "Failed to send verification email to {}: {}",
                    maskEmail(toEmail),
                    e.getMessage()
            );

            throw new RuntimeException(
                    "Failed to send verification email",
                    e
            );
        }
    }

    /**
     * Request body sent to Resend.
     */
    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ResendSendRequest {

        private String from;

        private List<String> to;

        private String subject;

        @JsonProperty("html")
        private String html;

        @JsonProperty("text")
        private String text;
    }

    /**
     * Response returned by Resend.
     *
     * Example:
     * {
     *   "id": "re_xxxxxxxxx"
     * }
     */
    @Data
    public static class ResendSendResponse {

        private String id;
    }

    private String buildHtmlBody(String link) {

        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport"
                          content="width=device-width, initial-scale=1.0">
                    <title>Verify your email</title>
                </head>

                <body style="
                    margin:0;
                    padding:0;
                    background:#f8fafc;
                    font-family:Arial,Helvetica,sans-serif;
                ">

                <table role="presentation"
                       cellpadding="0"
                       cellspacing="0"
                       width="100%%"
                       style="
                           background:#f8fafc;
                           padding:32px 0;
                       ">

                    <tr>
                        <td align="center">

                            <table role="presentation"
                                   cellpadding="0"
                                   cellspacing="0"
                                   width="560"
                                   style="
                                       background:#ffffff;
                                       border-radius:16px;
                                   ">

                                <tr>
                                    <td style="padding:40px 32px;">

                                        <!-- Logo -->
                                        <div style="
                                            text-align:center;
                                            margin-bottom:24px;
                                        ">
                                            <span style="
                                                font-size:28px;
                                                font-weight:800;
                                                color:#4f46e5;
                                            ">
                                                Prep<span style="color:#0d9488;">2</span>Place
                                            </span>
                                        </div>

                                        <!-- Heading -->
                                        <h1 style="
                                            font-size:24px;
                                            font-weight:700;
                                            color:#0f172a;
                                            margin:0 0 12px 0;
                                            text-align:center;
                                        ">
                                            Verify your email address
                                        </h1>

                                        <!-- Description -->
                                        <p style="
                                            font-size:16px;
                                            line-height:1.6;
                                            color:#475569;
                                            margin:0 0 24px 0;
                                            text-align:center;
                                        ">
                                            Thanks for signing up!
                                            Click the button below to confirm
                                            your email and get started with
                                            your placement journey.
                                        </p>

                                        <!-- Button -->
                                        <table role="presentation"
                                               cellpadding="0"
                                               cellspacing="0"
                                               width="100%%">

                                            <tr>
                                                <td align="center"
                                                    style="padding:8px 0 24px 0;">

                                                    <a href="%s"
                                                       style="
                                                           display:inline-block;
                                                           padding:14px 32px;
                                                           background:#4f46e5;
                                                           color:#ffffff;
                                                           font-weight:700;
                                                           font-size:16px;
                                                           text-decoration:none;
                                                           border-radius:12px;
                                                       ">
                                                        Verify Email Address
                                                    </a>

                                                </td>
                                            </tr>

                                        </table>

                                        <!-- Fallback link -->
                                        <p style="
                                            font-size:14px;
                                            line-height:1.6;
                                            color:#64748b;
                                            margin:0 0 8px 0;
                                            text-align:center;
                                        ">
                                            Or copy and paste this link
                                            into your browser:
                                        </p>

                                        <p style="
                                            font-size:13px;
                                            line-height:1.5;
                                            color:#4f46e5;
                                            word-break:break-all;
                                            background:#f1f5f9;
                                            padding:12px;
                                            border-radius:8px;
                                            margin:0 0 24px 0;
                                            text-align:center;
                                        ">
                                            %s
                                        </p>

                                        <!-- Footer -->
                                        <div style="
                                            border-top:1px solid #e2e8f0;
                                            padding-top:20px;
                                        ">

                                            <p style="
                                                font-size:13px;
                                                color:#64748b;
                                                margin:0 0 4px 0;
                                            ">
                                                This link expires in 30 minutes.
                                            </p>

                                            <p style="
                                                font-size:13px;
                                                color:#64748b;
                                                margin:0;
                                            ">
                                                If you didn't create this
                                                account, you can safely
                                                ignore this email.
                                            </p>

                                        </div>

                                    </td>
                                </tr>

                            </table>

                        </td>
                    </tr>

                </table>

                </body>
                </html>
                """.formatted(link, link);
    }

    private String buildTextBody(String link) {

        return """
                Verify your email for Prep2Place

                Thanks for signing up!

                Click this link to confirm your email:

                %s

                This link expires in 30 minutes.

                If you didn't create this account,
                you can safely ignore this email.

                - The Prep2Place Team
                """.formatted(link);
    }

    /**
     * Prevent full email addresses from appearing in logs.
     */
    private String maskEmail(String email) {

        if (email == null || email.isBlank()) {
            return "***";
        }

        int atIndex = email.indexOf('@');

        if (atIndex <= 1) {
            return "***" + email.substring(atIndex);
        }

        return email.charAt(0)
                + "***"
                + email.substring(atIndex);
    }

    @Override
    public void sendRoundReminderEmail(
            String toEmail,
            String candidateName,
            String companyName,
            String roundName,
            String startTimeFormatted,
            String durationMinutes,
            String testUrl
    ) {
        if (!emailEnabled || resendApiKey == null || resendApiKey.isBlank() || toEmail == null || toEmail.isBlank()) {
            log.info("[Mock Reminder Email] To: {}, Candidate: {}, Drive: {}, Round: {}, Start: {}",
                    maskEmail(toEmail), candidateName, companyName, roundName, startTimeFormatted);
            return;
        }

        try {
            String subject = "Upcoming Assessment Reminder: %s (%s)".formatted(roundName, companyName);
            String html = """
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                        <h2 style="color: #4f46e5;">Upcoming Assessment Round Reminder</h2>
                        <p>Hello <strong>%s</strong>,</p>
                        <p>This is an automated reminder that your upcoming round for <strong>%s</strong> is scheduled to begin soon:</p>
                        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
                            <p style="margin: 4px 0;"><strong>Round:</strong> %s</p>
                            <p style="margin: 4px 0;"><strong>Start Time:</strong> %s</p>
                            <p style="margin: 4px 0;"><strong>Duration:</strong> %s mins</p>
                        </div>
                        <p>Please ensure you are in a quiet environment with a working camera and microphone for automated proctoring.</p>
                        <div style="text-align: center; margin: 24px 0;">
                            <a href="%s" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                Access Assessment Portal
                            </a>
                        </div>
                        <p style="color: #64748b; font-size: 12px;">Best regards,<br/>The Prep2Place Recruitment Operations Team</p>
                    </div>
                    """.formatted(candidateName, companyName, roundName, startTimeFormatted, durationMinutes, testUrl);

            ResendSendRequest request = ResendSendRequest.builder()
                    .from(emailFrom)
                    .to(List.of(toEmail))
                    .subject(subject)
                    .html(html)
                    .text("Upcoming assessment: " + roundName + " with " + companyName + " at " + startTimeFormatted)
                    .build();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(resendApiKey);

            restTemplate.exchange(RESEND_API_URL, HttpMethod.POST, new HttpEntity<>(request, headers), String.class);
            log.info("Reminder email dispatched to {}", maskEmail(toEmail));
        } catch (Exception ex) {
            log.warn("Failed to dispatch reminder email to {}: {}", maskEmail(toEmail), ex.getMessage());
        }
    }
}