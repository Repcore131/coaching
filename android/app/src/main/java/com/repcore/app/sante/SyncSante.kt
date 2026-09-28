package com.repcore.app.sante

import android.content.Context
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.repcore.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId
import kotlin.reflect.KClass

// ══ LA SYNCHRONISATION : HEALTH CONNECT → SERVEUR LÉGER ════════════════════
// UNE seule fonction, appelée à trois endroits : à l'ouverture de l'app
// (LauncherActivity, par WorkManager, sans retarder la fenêtre), toutes les
// 6 heures (SyncSanteWorker, si la lecture en arrière-plan est accordée), et
// depuis ConnecterSanteActivity.
//
// Fenêtre : la dernière réussite moins 2 jours ; au moins 3 jours, au plus 30.
// Envoi : POST <serveur>/sante/i, en-tête X-RepCore-Jeton, par paquets de 14
// jours. 401 : le jeton a été révoqué ailleurs (« Déconnecter ») : il est
// effacé, et la synchronisation périodique arrêtée.
object SyncSante {

    val PERMISSIONS: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
    )
    const val PERMISSION_ARRIERE_PLAN = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND

    sealed class Resultat {
        data class Ok(val jours: Int) : Resultat()
        object SansJeton : Resultat()
        object Indisponible : Resultat()
        object SansPermission : Resultat()
        object Revoque : Resultat()
        data class Erreur(val message: String) : Resultat()
    }

    private val verrou = Mutex()

    /** Health Connect est-il utilisable sur ce téléphone ? (Android 9 minimum.) */
    fun statut(ctx: Context): Int =
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) HealthConnectClient.SDK_UNAVAILABLE
        else HealthConnectClient.getSdkStatus(ctx)

    fun arrierePlanDisponible(client: HealthConnectClient): Boolean =
        client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    suspend fun synchroniser(ctx: Context): Resultat = verrou.withLock {
        withContext(Dispatchers.IO) {
            try { executer(ctx.applicationContext) }
            catch (e: SecurityException) { Resultat.SansPermission }
            catch (e: Exception) { Resultat.Erreur(e.javaClass.simpleName) }
        }
    }

    private suspend fun executer(ctx: Context): Resultat {
        val jeton = Coffre.jeton(ctx) ?: return Resultat.SansJeton
        if (statut(ctx) != HealthConnectClient.SDK_AVAILABLE) return Resultat.Indisponible
        val client = HealthConnectClient.getOrCreate(ctx)
        val accordees = client.permissionController.getGrantedPermissions()
        fun a(k: KClass<out Record>) = HealthPermission.getReadPermission(k) in accordees
        if (PERMISSIONS.none { it in accordees }) return Resultat.SansPermission

        val zone = ZoneId.systemDefault()
        val maintenant = Instant.now()
        val aujourdhui = LocalDate.now(zone)
        val reussite = Coffre.derniereReussite(ctx)?.let { Instant.ofEpochMilli(it).atZone(zone).toLocalDate() }
        val debut = Jours.debutFenetre(aujourdhui, reussite)
        val depuis = debut.atStartOfDay(zone).toInstant()
        val plage = TimeRangeFilter.between(depuis, maintenant)

        // PAS : agrégés par jour ; Health Connect dédoublonne les sources.
        val pas = mutableMapOf<LocalDate, Long>()
        val originesPas = mutableListOf<String>()
        if (a(StepsRecord::class)) {
            val groupes = client.aggregateGroupByPeriod(AggregateGroupByPeriodRequest(
                metrics = setOf(StepsRecord.COUNT_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(debut.atStartOfDay(), aujourdhui.plusDays(1).atStartOfDay()),
                timeRangeSlicer = Period.ofDays(1)))
            for (g in groupes) {
                val n = g.result[StepsRecord.COUNT_TOTAL] ?: continue
                pas[g.startTime.toLocalDate()] = n
                g.result.dataOrigins.forEach { originesPas += Jours.marque(it.packageName) }
            }
        }
        // SOMMEIL : une nuit commencée la veille du premier jour compte (réveil dans la fenêtre).
        val nuits = if (!a(SleepSessionRecord::class)) emptyList() else
            lire(client, SleepSessionRecord::class, TimeRangeFilter.between(depuis.minusSeconds(86400), maintenant)).map { s ->
                Nuit(s.startTime, s.endTime, s.stages.map { Etape(it.startTime, it.endTime, Jours.phaseDe(it.stage)) },
                    Jours.marque(s.metadata.dataOrigin.packageName))
            }
        val fc = if (!a(RestingHeartRateRecord::class)) emptyList() else
            lire(client, RestingHeartRateRecord::class, plage).map { Mesure(it.time, it.beatsPerMinute.toDouble()) }
        val vfc = if (!a(HeartRateVariabilityRmssdRecord::class)) emptyList() else
            lire(client, HeartRateVariabilityRmssdRecord::class, plage).map { Mesure(it.time, it.heartRateVariabilityMillis) }
        val poids = if (!a(WeightRecord::class)) emptyList() else
            lire(client, WeightRecord::class, plage).map { Mesure(it.time, it.weight.inKilograms) }
        val gras = if (!a(BodyFatRecord::class)) emptyList() else
            lire(client, BodyFatRecord::class, plage).map { Mesure(it.time, it.percentage.value) }

        val jours = Jours.construire(zone, debut, aujourdhui, pas, nuits, fc, vfc, poids, gras)
        val origines = mutableMapOf<String, String>()
        Jours.origineMajoritaire(originesPas)?.let { origines["pas"] = it }
        Jours.origineMajoritaire(nuits.mapNotNull { it.origine })?.let { origines["sommeil"] = it }

        for (p in Jours.paquets(jours)) {
            when (val code = poster(jeton, Jours.corps(p, origines, System.currentTimeMillis()))) {
                200 -> Unit
                401 -> { Coffre.effacer(ctx); PlanifSante.arreter(ctx); return Resultat.Revoque }
                else -> return Resultat.Erreur("HTTP $code")
            }
        }
        Coffre.reussite(ctx, maintenant.toEpochMilli())
        return Resultat.Ok(jours.size)
    }

    private suspend fun <T : Record> lire(client: HealthConnectClient, type: KClass<T>, plage: TimeRangeFilter): List<T> {
        val tout = mutableListOf<T>()
        var page: String? = null
        do {
            val r = client.readRecords(ReadRecordsRequest(type, plage, pageToken = page))
            tout += r.records
            page = r.pageToken
        } while (!page.isNullOrEmpty())
        return tout
    }

    /** Rend le code HTTP. Le corps n'est jamais journalisé. */
    private fun poster(jeton: String, corps: String): Int {
        val c = URL(BuildConfig.SERVEUR + "/sante/i").openConnection() as HttpURLConnection
        return try {
            c.requestMethod = "POST"
            c.connectTimeout = 15000; c.readTimeout = 20000
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            c.setRequestProperty("X-RepCore-Jeton", jeton)
            c.outputStream.use { it.write(corps.toByteArray(Charsets.UTF_8)) }
            val code = c.responseCode
            try { (if (code < 400) c.inputStream else c.errorStream)?.close() } catch (_: Exception) {}
            code
        } finally { c.disconnect() }
    }

    /** Le compte lié au jeton, masqué (l•••@gmail.com), pour le faire confirmer. */
    fun compteDuJeton(jeton: String): String? {
        val c = URL(BuildConfig.SERVEUR + "/sante/qui").openConnection() as HttpURLConnection
        return try {
            c.requestMethod = "POST"
            c.connectTimeout = 15000; c.readTimeout = 15000
            c.setRequestProperty("X-RepCore-Jeton", jeton)
            if (c.responseCode != 200) return null
            val t = c.inputStream.bufferedReader().use { it.readText() }
            org.json.JSONObject(t).optString("compte").takeIf { it.isNotEmpty() }
        } catch (e: Exception) { null } finally { c.disconnect() }
    }
}
