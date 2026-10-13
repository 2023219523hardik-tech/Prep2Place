package com.placement.email;

public interface EmailService {
    void sendVerificationEmail(String toEmail, String token, String appUrl);
    void sendRoundReminderEmail(String toEmail, String candidateName, String companyName, String roundName, String startTimeFormatted, String durationMinutes, String testUrl);
}
