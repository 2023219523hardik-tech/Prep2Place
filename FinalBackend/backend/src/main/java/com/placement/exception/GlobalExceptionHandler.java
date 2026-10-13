package com.placement.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(com.placement.jobs.exception.ScheduleConflictException.class)
    public ResponseEntity<Object> handleScheduleConflict(com.placement.jobs.exception.ScheduleConflictException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("error", "Bad Request");
        body.put("code", "HIRING_ROUND_SCHEDULE_CONFLICT");
        body.put("message", ex.getMessage());
        body.put("conflicts", ex.getConflicts());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Object> handleApiException(ApiException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", ex.getStatus().value());
        body.put("error", ex.getStatus().getReasonPhrase());
        if (ex.getCode() != null) body.put("code", ex.getCode());
        body.put("message", ex.getMessage());
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Object> handleBadCredentials(BadCredentialsException ex) {
        return build(HttpStatus.UNAUTHORIZED, "Invalid email or password", null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Object> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(fe ->
                fieldErrors.put(fe.getField(), fe.getDefaultMessage()));
        return build(HttpStatus.BAD_REQUEST, "Validation failed", fieldErrors);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Object> handleDataIntegrity(DataIntegrityViolationException ex, WebRequest request) {
        log.warn("Data integrity violation on {}: {}", request.getDescription(false), ex.getMessage());
        String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        if (msg.contains("null value") || msg.contains("not-null")) {
            return build(HttpStatus.BAD_REQUEST, "Required application field is missing", null);
        }
        if (msg.contains("check constraint")) {
            return build(HttpStatus.BAD_REQUEST, "Validation check failed: " + (ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : "constraint violation"), null);
        }
        String message = "A record with this information already exists";
        if (msg.contains("email")) {
            message = "An account with this email already exists";
        } else if (msg.contains("uk_job_applicant") || msg.contains("job_application") || (msg.contains("job_id") && msg.contains("applicant_id"))) {
            message = "You have already applied to this drive";
        } else if (msg.contains("verification_token") || msg.contains("token_hash")) {
            message = "Token conflict; please try again";
        } else if (msg.contains("uk_coding_problem_source_question_id") || msg.contains("source_question_id")) {
            message = "A question with this slug or identifier already exists. Please choose 'Update Existing' or 'Skip Duplicates'.";
        } else if (msg.contains("uk_company_slug") || msg.contains("company_slug")) {
            message = "A company with this identifier already exists.";
        }
        return build(HttpStatus.CONFLICT, message, null);
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Object> handleMessageNotReadable(org.springframework.http.converter.HttpMessageNotReadableException ex) {
        String msg = "Malformed request payload: " + (ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, msg, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleGeneric(Exception ex, WebRequest request) {
        String traceId = UUID.randomUUID().toString();
        log.error("Unhandled exception on {} [traceId={}]: {}", request.getDescription(false), traceId, ex.getMessage(), ex);

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean isAdmin = false;
        if (authentication != null) {
            for (GrantedAuthority authority : authentication.getAuthorities()) {
                String auth = authority.getAuthority();
                if ("ROLE_ADMIN".equals(auth) || "ADMIN".equals(auth)) {
                    isAdmin = true;
                    break;
                }
            }
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Something went wrong. Please try again.");
        body.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        body.put("traceId", traceId);
        if (isAdmin) {
            StringWriter sw = new StringWriter();
            ex.printStackTrace(new PrintWriter(sw));
            body.put("stackTrace", sw.toString());
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    private ResponseEntity<Object> build(HttpStatus status, String message, Object details) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        if (details != null) body.put("details", details);
        return ResponseEntity.status(status).body(body);
    }
}
