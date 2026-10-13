package com.placement.managedtest.controller;

import com.placement.managedtest.dto.ManagedTestDtos.*;
import com.placement.managedtest.service.ManagedTestLiveMonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Live monitoring for admins. Gated by the existing "/api/admin/**" -> hasAnyRole("ADMIN",
 * "PLACEMENT_ADMIN") rule in SecurityConfig (verified, not assumed, same check already done for
 * every other admin surface added this session). Base path matches this module's real existing
 * convention (ManagedTestAdminController is "/api/admin/tests") rather than the illustrative
 * "/api/admin/mock-tests" paths a spec document might suggest - there is no such prefix anywhere
 * else in this codebase.
 */
@RestController
@RequestMapping("/api/admin/tests")
@RequiredArgsConstructor
public class ManagedTestLiveMonitoringController {

    private final ManagedTestLiveMonitoringService liveMonitoringService;

    /** Which tests currently have at least one student actively taking them - the dashboard-level
     *  "Live Monitoring" landing view before an admin drills into one test. */
    @GetMapping("/live")
    public List<Long> testsWithActiveAttempts() {
        return liveMonitoringService.testIdsWithActiveAttempts();
    }

    @GetMapping("/{testId}/live-students")
    public List<LiveStudentSummary> activeStudents(@PathVariable Long testId) {
        return liveMonitoringService.activeStudents(testId);
    }

    /** The "select one student for detailed monitoring" view (spec section 49/50) - progress,
     *  timer, violation history. Records a LIVE_SESSION_VIEWED audit entry on every call; see
     *  ManagedTestLiveMonitoringService.studentDetail. */
    @GetMapping("/{testId}/students/{studentId}/live")
    public LiveStudentDetail studentDetail(@PathVariable Long testId, @PathVariable Long studentId) {
        return liveMonitoringService.studentDetail(testId, studentId);
    }
}