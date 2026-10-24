package com.multilingo.backend.modules.testing.support;

import org.springframework.test.context.DynamicPropertyRegistry;
import java.net.URI;
import java.sql.*;
import java.util.*;

/** Only creates/drops its UUID schema inside the explicitly named disposable test database. */
public final class MultilingualPostgresDatabase {
    private final String schema="tv3_ml_"+UUID.randomUUID().toString().replace("-","");
    private boolean created;
    private String url,user,password;
    public void configure(DynamicPropertyRegistry registry) throws Exception {
        url=Objects.requireNonNull(System.getenv("TV3_PG_TEST_URL"),"TV3_PG_TEST_URL is required");
        URI parsed=URI.create(url.substring("jdbc:".length()));
        if(!"/tv3_multilingual_test".equals(parsed.getPath()))throw new IllegalArgumentException("Only tv3_multilingual_test is allowed");
        user=Objects.requireNonNull(System.getenv("TV3_PG_TEST_USER"));password=Objects.requireNonNull(System.getenv("TV3_PG_TEST_PASSWORD"));
        try(var connection=DriverManager.getConnection(url,user,password);var statement=connection.createStatement()){
            statement.execute("CREATE SCHEMA "+schema);created=true;
        }
        registry.add("spring.datasource.url",()->url+(url.contains("?")?"&":"?")+"currentSchema="+schema);
        registry.add("spring.datasource.username",()->user);registry.add("spring.datasource.password",()->password);
        registry.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
        registry.add("spring.jpa.database-platform",()->"org.hibernate.dialect.PostgreSQLDialect");
        registry.add("spring.jpa.hibernate.ddl-auto",()->"create");
        registry.add("spring.jpa.properties.hibernate.default_schema",()->schema);
        registry.add("spring.datasource.hikari.connection-init-sql",()->"SET statement_timeout = '15s'");
        registry.add("spring.flyway.enabled",()->"false");
    }
    public void close() throws Exception {
        if(!created)return;
        try(var connection=DriverManager.getConnection(url,user,password);var statement=connection.createStatement()){
            statement.execute("DROP SCHEMA "+schema+" CASCADE");created=false;
        }
    }
}
