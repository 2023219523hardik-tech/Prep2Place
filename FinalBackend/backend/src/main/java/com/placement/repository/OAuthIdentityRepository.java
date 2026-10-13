package com.placement.repository;

import com.placement.entity.OAuthIdentity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OAuthIdentityRepository extends JpaRepository<OAuthIdentity, Long> {
    Optional<OAuthIdentity> findByProviderAndProviderAccountId(String provider, String providerAccountId);
    boolean existsByProviderAndProviderAccountId(String provider, String providerAccountId);
}
