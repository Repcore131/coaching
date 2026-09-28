# Health Connect et WorkManager publient leurs propres règles (consumer rules).
# Le Worker est instancié par réflexion : son nom doit survivre.
-keep class com.repcore.app.sante.SyncSanteWorker { *; }
# Tink (sous security-crypto) cite des annotations absentes à l'exécution.
-dontwarn javax.annotation.Nullable
-dontwarn javax.annotation.concurrent.GuardedBy
