package com.app.common.security.fido2.repository;

import com.app.common.security.fido2.entity.PasskeyCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PasskeyCredentialJpaRepository extends JpaRepository<PasskeyCredential, String> {

    @Query("SELECT p FROM PasskeyCredential p JOIN User u ON p.userId = u.id WHERE u.username = :username")
    List<PasskeyCredential> findByUserEmail(@Param("username") String username);

    Optional<PasskeyCredential> findByCredentialId(String credentialId);

    @Modifying
    @Query("UPDATE PasskeyCredential p SET p.signatureCount = :count WHERE p.credentialId = :credentialId")
    void updateSignatureCount(@Param("credentialId") String credentialId, @Param("count") long count);
}
