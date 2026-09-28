package com.repcore.app.sante

import android.content.Context
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/** Une synchronisation, lancée par WorkManager (ouverture de l'app, ou toutes les 6 h). */
class SyncSanteWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = when (SyncSante.synchroniser(applicationContext)) {
        is SyncSante.Resultat.Erreur -> if (runAttemptCount < 2) Result.retry() else Result.failure()
        is SyncSante.Resultat.Ok -> { PlanifSante.planifierPeriodique(applicationContext); Result.success() }
        else -> Result.success()
    }
}

object PlanifSante {
    private const val PERIODIQUE = "repcore-sante-6h"
    private const val OUVERTURE = "repcore-sante-ouverture"
    private val RESEAU = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    /** À l'ouverture de l'app : en tâche de fond, sans retarder la fenêtre. */
    @JvmStatic
    fun lancerMaintenant(ctx: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return
        WorkManager.getInstance(ctx).enqueueUniqueWork(OUVERTURE, ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<SyncSanteWorker>().setConstraints(RESEAU).build())
    }

    /** Toutes les 6 heures, avec réseau, SEULEMENT si la lecture en arrière-plan est accordée. */
    suspend fun planifierPeriodique(ctx: Context) {
        val wm = WorkManager.getInstance(ctx)
        val ok = try {
            SyncSante.statut(ctx) == HealthConnectClient.SDK_AVAILABLE && Coffre.jeton(ctx) != null &&
                SyncSante.PERMISSION_ARRIERE_PLAN in HealthConnectClient.getOrCreate(ctx).permissionController.getGrantedPermissions()
        } catch (e: Exception) { false }
        if (ok) wm.enqueueUniquePeriodicWork(PERIODIQUE, ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<SyncSanteWorker>(6, TimeUnit.HOURS).setConstraints(RESEAU).build())
        else wm.cancelUniqueWork(PERIODIQUE)
    }

    fun arreter(ctx: Context) {
        WorkManager.getInstance(ctx).cancelUniqueWork(PERIODIQUE)
    }
}
