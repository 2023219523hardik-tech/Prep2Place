package com.placement.repository;

import com.placement.entity.PlacementDrive;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlacementDriveRepository extends JpaRepository<PlacementDrive, Long> {

    List<PlacementDrive> findAllByOrderByCreatedAtDesc();

    Page<PlacementDrive> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
