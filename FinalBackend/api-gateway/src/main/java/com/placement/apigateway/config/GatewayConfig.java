package com.placement.apigateway.config;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import io.micrometer.tracing.Tracer;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Configuration
public class GatewayConfig {

    @Value("${GATEWAY_CORS_ALLOWED_ORIGINS:*}")
    private String allowedOrigins;

    @Bean
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration config = new CorsConfiguration();

        if ("*".equals(allowedOrigins)) {
            config.addAllowedOriginPattern("*");
        } else {
            List<String> origins = Arrays.asList(allowedOrigins.split(","));
            config.setAllowedOrigins(origins);
        }

        config.setAllowedMethods(Arrays.asList(
                HttpMethod.GET.name(),
                HttpMethod.POST.name(),
                HttpMethod.PUT.name(),
                HttpMethod.DELETE.name(),
                HttpMethod.OPTIONS.name(),
                HttpMethod.PATCH.name()
        ));

        config.addAllowedHeader("*");
        config.setAllowCredentials(!"*".equals(allowedOrigins));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsWebFilter(source);
    }

    @Bean
    public GlobalFilter correlationAndTraceFilter(ObjectProvider<Tracer> tracerProvider) {
        return new GlobalFilter() {
            @Override
            public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
                ServerHttpRequest request = exchange.getRequest();

                String correlationId = request.getHeaders().getFirst("X-Correlation-Id");
                ServerWebExchange workingExchange = exchange;
                if (correlationId == null || correlationId.isEmpty()) {
                    correlationId = UUID.randomUUID().toString();
                    ServerHttpRequest mutatedRequest = request.mutate()
                            .header("X-Correlation-Id", correlationId)
                            .build();
                    workingExchange = exchange.mutate().request(mutatedRequest).build();
                }

                final String finalCorrelationId = correlationId;
                final ServerWebExchange finalExchange = workingExchange;
                final Tracer tracer = tracerProvider.getIfAvailable();
                return chain.filter(workingExchange).then(Mono.fromRunnable(() -> {
                    ServerHttpResponse response = finalExchange.getResponse();
                    response.getHeaders().add("X-Correlation-Id", finalCorrelationId);

                    String traceId = "";
                    if (tracer != null && tracer.currentSpan() != null) {
                        traceId = tracer.currentSpan().context().traceId();
                    }
                    response.getHeaders().add("X-Trace-Id", traceId);
                }));
            }
        };
    }
}
