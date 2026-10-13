package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "oauth_identity", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"provider", "provider_account_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OAuthIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 64)
    private String provider;

    @Column(name = "provider_account_id", nullable = false)
    private String providerAccountId;

    @Column(name = "provider_email")
    private String providerEmail;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
