package com.app;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

@SuppressWarnings("all")

class ModularityTests {

    ApplicationModules modules = ApplicationModules.of(Application.class);

    @Test
    void verifyModularStructure() {
        modules.verify();
    }

    @Test
    void generateModuleDocumentation() {
        new Documenter(modules)
            .writeModulesAsPlantUml()
            .writeIndividualModulesAsPlantUml();
    }
}
