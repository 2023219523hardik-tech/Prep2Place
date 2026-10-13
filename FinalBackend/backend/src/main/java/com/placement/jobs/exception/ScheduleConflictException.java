package com.placement.jobs.exception;

import com.placement.jobs.dto.CompanyAdminDtos.ScheduleConflictDto;
import lombok.Getter;

import java.util.List;

@Getter
public class ScheduleConflictException extends RuntimeException {

    public static final String ERROR_CODE = "HIRING_ROUND_SCHEDULE_CONFLICT";

    private final String errorCode;
    private final List<ScheduleConflictDto> conflicts;

    public ScheduleConflictException(String message, List<ScheduleConflictDto> conflicts) {
        super(message);
        this.errorCode = ERROR_CODE;
        this.conflicts = conflicts != null ? conflicts : List.of();
    }
}
