package com.placement.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.kafka.enabled", havingValue = "true")
public class KafkaAuthEventListener {

    private final StringRedisTemplate redisTemplate;

    @Value("${app.kafka.enabled:true}")
    private boolean kafkaEnabled;

    private static final String DEDUP_KEY_PREFIX = "kafka-dedup:";
    private static final int DEDUP_TTL_HOURS = 24;

    @KafkaListener(topics = "${app.kafka.auth-topic:auth-events}",
            groupId = "${spring.kafka.consumer.group-id:placement-auth-group}")
    public void onAuthEvent(AuthEvent<?> event,
                            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
                            @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
                            @Header(KafkaHeaders.OFFSET) long offset) {
        if (!kafkaEnabled) return;
        if (isDuplicate(event)) {
            log.debug("Duplicate auth event skipped: {}", event.getEventId());
            return;
        }
        log.info("Consumed auth event type={} id={} topic={}:{}:{}",
                event.getEventType(), event.getEventId(), topic, partition, offset);
        try {
            switch (event.getEventType()) {
                case AuthEvent.TYPE_USER_REGISTERED -> log.info("Audit: user registered payload={}", event.getPayload());
                case AuthEvent.TYPE_EMAIL_VERIFIED -> log.info("Audit: email verified payload={}", event.getPayload());
                case AuthEvent.TYPE_USER_ACTIVATED -> log.info("Audit: user activated payload={}", event.getPayload());
                case AuthEvent.TYPE_USER_LOGGED_IN -> log.debug("Audit: user logged in payload={}", event.getPayload());
                case AuthEvent.TYPE_OAUTH_ACCOUNT_LINKED -> log.info("Audit: OAuth linked payload={}", event.getPayload());
                default -> log.warn("Unknown auth event type: {}", event.getEventType());
            }
        } catch (Exception e) {
            log.error("Error processing auth event {}: {}", event.getEventId(), e.getMessage(), e);
            throw e;
        }
    }

    @RetryableTopic(
            attempts = "3",
            backoff = @Backoff(delay = 1000, multiplier = 2.0),
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = "-dlt"
    )
    @KafkaListener(topics = "${app.kafka.email-topic:email-events}",
            groupId = "${spring.kafka.consumer.group-id:placement-auth-group}")
    public void onEmailEvent(AuthEvent<?> event,
                             @Header(KafkaHeaders.RECEIVED_TOPIC) String topic) {
        if (!kafkaEnabled) return;
        if (isDuplicate(event)) {
            log.debug("Duplicate email event skipped: {}", event.getEventId());
            return;
        }
        log.info("Consumed email event type={} id={} topic={}", event.getEventType(), event.getEventId(), topic);
        try {
            if (AuthEvent.TYPE_EMAIL_VERIFICATION_REQUESTED.equals(event.getEventType())) {
                log.info("Audit: email verification requested payload={}", event.getPayload());
            }
        } catch (Exception e) {
            log.error("Error processing email event {}: {}", event.getEventId(), e.getMessage(), e);
            throw e;
        }
    }

    @KafkaListener(topics = "${app.kafka.email-topic:email-events}-dlt",
            groupId = "${spring.kafka.consumer.group-id:placement-auth-group}")
    public void onEmailEventDlt(AuthEvent<?> event,
                                @Header(KafkaHeaders.RECEIVED_TOPIC) String topic) {
        log.error("Email event DLT received: id={} type={} topic={} payload={}",
                event.getEventId(), event.getEventType(), topic, event.getPayload());
    }

    private boolean isDuplicate(AuthEvent<?> event) {
        try {
            String key = DEDUP_KEY_PREFIX + event.getEventId();
            Boolean set = redisTemplate.opsForValue()
                    .setIfAbsent(key, "1", DEDUP_TTL_HOURS, TimeUnit.HOURS);
            return !Boolean.TRUE.equals(set);
        } catch (Exception e) {
            log.warn("Redis dedup unavailable for event {}, processing anyway: {}",
                    event.getEventId(), e.getMessage());
            return false;
        }
    }
}
