package com.placement.exception;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public ApiException(String message, HttpStatus status) {
        this(message, status, null);
    }

    public ApiException(String message, HttpStatus status, String code) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public static ApiException notFound(String message) {
        return new ApiException(message, HttpStatus.NOT_FOUND);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(message, HttpStatus.BAD_REQUEST);
    }

    public static ApiException conflict(String message) {
        return new ApiException(message, HttpStatus.CONFLICT);
    }

    public static ApiException conflict(String code, String message) {
        return new ApiException(message, HttpStatus.CONFLICT, code);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(message, HttpStatus.UNAUTHORIZED);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(message, HttpStatus.FORBIDDEN);
    }

    public static ApiException tooManyRequests(String message) {
        return new ApiException(message, HttpStatus.TOO_MANY_REQUESTS);
    }

    public static ApiException internal(String message) {
        return new ApiException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
