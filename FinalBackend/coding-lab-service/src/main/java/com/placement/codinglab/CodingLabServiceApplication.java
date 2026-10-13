package com.placement.codinglab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class CodingLabServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CodingLabServiceApplication.class, args);
    }
}
