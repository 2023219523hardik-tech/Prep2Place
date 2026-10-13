package com.placement.coding;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class CodingServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CodingServiceApplication.class, args);
    }
}
