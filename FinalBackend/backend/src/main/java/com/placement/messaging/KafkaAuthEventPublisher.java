package com.placement.messaging;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentLinkedQueue;

@Slf4j
@Service
public class KafkaAuthEventPublisher {

    @Autowired(required = false)
    private KafkaTemplate<String, AuthEvent<?>> kafkaTemplate;

    private final ConcurrentLinkedQueue<AuthEvent<?>> pendingEvents =
            new ConcurrentLinkedQueue<>();

    @Value("${app.kafka.enabled:true}")
    private boolean kafkaEnabled;

    @Value("${app.kafka.auth-topic:auth-events}")
    private String authTopic;

    @Value("${app.kafka.email-topic:email-events}")
    private String emailTopic;

    /**
     * Queue an authentication event for publishing.
     */
    public void publishAuthEvent(AuthEvent<?> event) {

        if (event == null) {
            log.warn("Attempted to publish null auth event");
            return;
        }

        if (!kafkaEnabled) {
            log.debug(
                    "Kafka disabled - dropping auth event: {}",
                    event.getEventType()
            );
            return;
        }

        pendingEvents.offer(event);

        log.debug(
                "Queued auth event: type={}, eventId={}, pending={}",
                event.getEventType(),
                event.getEventId(),
                pendingEvents.size()
        );
    }

    /**
     * Flush all pending events to Kafka.
     *
     * This method is intentionally not a Spring event listener.
     */
    public void flushPendingEvents() {

        if (!kafkaEnabled) {
            pendingEvents.clear();
            return;
        }

        AuthEvent<?> event;

        while ((event = pendingEvents.poll()) != null) {
            dispatch(event);
        }
    }

    /**
     * Send an individual event to the appropriate Kafka topic.
     */
    private void dispatch(AuthEvent<?> event) {

        if (kafkaTemplate == null) {
            return;
        }

        String topic =
                AuthEvent.TYPE_EMAIL_VERIFICATION_REQUESTED.equals(
                        event.getEventType()
                )
                        ? emailTopic
                        : authTopic;

        try {

            CompletableFuture<SendResult<String, AuthEvent<?>>> future =
                    kafkaTemplate.send(
                            topic,
                            event.getEventId().toString(),
                            event
                    );

            future.whenComplete((result, ex) -> {

                if (ex != null) {
                    log.error(
                            "Failed to publish event {} to topic {}: {}",
                            event.getEventType(),
                            topic,
                            ex.getMessage(),
                            ex
                    );
                    return;
                }

                if (result != null) {
                    log.debug(
                            "Published event {} to topic {} partition={} offset={}",
                            event.getEventType(),
                            topic,
                            result.getRecordMetadata().partition(),
                            result.getRecordMetadata().offset()
                    );
                }
            });

        } catch (Exception e) {

            log.error(
                    "Error dispatching event {} to topic {}: {}",
                    event.getEventType(),
                    topic,
                    e.getMessage(),
                    e
            );
        }
    }
}