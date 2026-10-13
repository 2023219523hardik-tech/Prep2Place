package com.placement.proctoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class ProctoringServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProctoringServiceApplication.class, args);
    }
}
