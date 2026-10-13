package com.placement.repository;

import com.placement.entity.StudentProfile;
import com.placement.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface StudentProfileRepository extends JpaRepository<StudentProfile, Long> {

    @EntityGraph(attributePaths = {"user", "targetRole"})
    @Query("SELECT p FROM StudentProfile p WHERE p.user = :user")
    Optional<StudentProfile> findByUser(@Param("user") User user);

    @EntityGraph(attributePaths = {"user", "targetRole"})
    @Query("SELECT p FROM StudentProfile p WHERE p.user.id = :userId")
    Optional<StudentProfile> findByUserId(@Param("userId") Long userId);
}
