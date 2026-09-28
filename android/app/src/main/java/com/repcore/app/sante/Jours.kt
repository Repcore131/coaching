package com.repcore.app.sante

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.SortedMap
import java.util.TreeMap

// ══ LA CONVERSION EN « JOURS » (format rc-sante-1) ═════════════════════════
//
// PUR : aucune classe Android, aucune classe Health Connect. SyncSante lit
// Health Connect et remet ici des mesures simples ; ce fichier les range en
// jours DU FUSEAU DU TÉLÉPHONE et fabrique le corps envoyé au serveur léger
// (cloudflare/src/sante.js). Éprouvé par JoursTest.

/** Les phases telles que RepCore les affiche. HORS : hors du lit, ignorée. */
enum class Phase { PROFOND, LEGER, PARADOXAL, EVEIL, HORS }

data class Etape(val debut: Instant, val fin: Instant, val phase: Phase)
data class Nuit(val debut: Instant, val fin: Instant, val etapes: List<Etape>, val origine: String? = null)
data class Mesure(val instant: Instant, val valeur: Double, val origine: String? = null)
data class Phases(val profond: Int, val leger: Int, val paradoxal: Int, val eveil: Int)

data class Jour(
    var pas: Long? = null,
    var sommeilMin: Int? = null,
    var coucher: String? = null,
    var lever: String? = null,
    var phases: Phases? = null,
    var fcRepos: Int? = null,
    var vfc: Double? = null,
    var vfcMethode: String? = null,
    var poids: Double? = null,
    var masseGrasse: Double? = null,
)

object Jours {
    /** Au plus 14 jours par envoi : c'est la limite du serveur. */
    const val JOURS_PAR_ENVOI = 14
    const val FENETRE_MIN = 3
    const val FENETRE_MAX = 30

    // Les types de phase de Health Connect (SleepSessionRecord.STAGE_TYPE_*),
    // recopiés ici pour que ce fichier reste pur ; JoursTest vérifie qu'ils
    // sont identiques aux constantes de la bibliothèque.
    const val HC_INCONNU = 0
    const val HC_EVEIL = 1
    const val HC_ENDORMI = 2
    const val HC_HORS_DU_LIT = 3
    const val HC_LEGER = 4
    const val HC_PROFOND = 5
    const val HC_PARADOXAL = 6
    const val HC_EVEIL_AU_LIT = 7

    /** DEEP → profond, LIGHT → léger, REM → paradoxal, AWAKE → éveil ; SLEEPING et inconnus → léger. */
    fun phaseDe(type: Int): Phase = when (type) {
        HC_PROFOND -> Phase.PROFOND
        HC_LEGER -> Phase.LEGER
        HC_PARADOXAL -> Phase.PARADOXAL
        HC_EVEIL, HC_EVEIL_AU_LIT -> Phase.EVEIL
        HC_HORS_DU_LIT -> Phase.HORS
        else -> Phase.LEGER
    }

    // LA TABLE DES MARQUES : le paquet qui a écrit la donnée dans Health
    // Connect (metadata.dataOrigin.packageName) → la clé de SAN_SOURCES dans
    // l'app. Tout le reste : « autre ».
    // ⚠ À VÉRIFIER SUR UN VRAI TÉLÉPHONE avant d'en ajouter : Paramètres >
    //   Health Connect > Autorisations des applications montre les paquets.
    val MARQUES: Map<String, String> = mapOf(
        "com.garmin.android.apps.connectmobile" to "garmin",
        "com.sec.android.app.shealth" to "samsung",
        "com.fitbit.FitbitMobile" to "fitbit",
        "com.withings.wiscale2" to "withings",
        "com.ouraring.oura" to "oura",
        "fi.polar.polarflow" to "polar",
    )

    fun marque(paquet: String?): String = MARQUES[paquet ?: ""] ?: "autre"

    /** La marque la plus fréquente ; « autre » ne gagne que s'il n'y a rien d'autre. */
    fun origineMajoritaire(marques: List<String>): String? {
        if (marques.isEmpty()) return null
        val connues = marques.filter { it != "autre" }
        val l = if (connues.isEmpty()) marques else connues
        return l.groupingBy { it }.eachCount().entries
            .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
            .first().key
    }

    /**
     * Le premier jour à lire : la dernière réussite moins 2 jours ; au moins
     * les 3 derniers jours, au plus les 30 derniers (aujourd'hui compris).
     */
    fun debutFenetre(aujourdhui: LocalDate, derniereReussite: LocalDate?): LocalDate {
        val auPlusTard = aujourdhui.minusDays((FENETRE_MIN - 1).toLong())
        val auPlusTot = aujourdhui.minusDays((FENETRE_MAX - 1).toLong())
        val voulu = derniereReussite?.minusDays(2) ?: auPlusTot
        return when {
            voulu.isAfter(auPlusTard) -> auPlusTard
            voulu.isBefore(auPlusTot) -> auPlusTot
            else -> voulu
        }
    }

    private val HHMM = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT)
    private fun minutes(a: Instant, b: Instant) = (b.toEpochMilli() - a.toEpochMilli()) / 60000.0

    /** Une nuit → (jour du réveil, champs du sommeil), ou null si moins de 30 min. */
    fun nuitVersJour(n: Nuit, zone: ZoneId): Pair<LocalDate, Jour>? {
        if (!n.fin.isAfter(n.debut)) return null
        val m = mutableMapOf<Phase, Double>()
        for (e in n.etapes) if (e.fin.isAfter(e.debut)) m[e.phase] = (m[e.phase] ?: 0.0) + minutes(e.debut, e.fin)
        val endormi = (m[Phase.PROFOND] ?: 0.0) + (m[Phase.LEGER] ?: 0.0) + (m[Phase.PARADOXAL] ?: 0.0)
        val total = if (endormi > 0) endormi else minutes(n.debut, n.fin)
        if (total < 30) return null
        val j = Jour(
            sommeilMin = Math.round(total).toInt(),
            coucher = n.debut.atZone(zone).format(HHMM),
            lever = n.fin.atZone(zone).format(HHMM),
        )
        if (endormi > 0) j.phases = Phases(
            profond = Math.round(m[Phase.PROFOND] ?: 0.0).toInt(),
            leger = Math.round(m[Phase.LEGER] ?: 0.0).toInt(),
            paradoxal = Math.round(m[Phase.PARADOXAL] ?: 0.0).toInt(),
            eveil = Math.round(m[Phase.EVEIL] ?: 0.0).toInt(),
        )
        return n.fin.atZone(zone).toLocalDate() to j
    }

    /** Tout ce qui a été lu → les jours, triés, bornés à [debut, fin]. */
    fun construire(
        zone: ZoneId,
        debut: LocalDate,
        fin: LocalDate,
        pas: Map<LocalDate, Long> = emptyMap(),
        nuits: List<Nuit> = emptyList(),
        fcRepos: List<Mesure> = emptyList(),
        vfcRmssd: List<Mesure> = emptyList(),
        poids: List<Mesure> = emptyList(),
        masseGrasse: List<Mesure> = emptyList(),
    ): SortedMap<LocalDate, Jour> {
        val jours = TreeMap<LocalDate, Jour>()
        fun dans(d: LocalDate) = !d.isBefore(debut) && !d.isAfter(fin)
        fun jour(d: LocalDate) = jours.getOrPut(d) { Jour() }
        fun date(i: Instant) = i.atZone(zone).toLocalDate()

        for ((d, n) in pas) if (dans(d) && n >= 0) jour(d).pas = n

        // Deux nuits pour le même réveil (une sieste) : la plus longue gagne.
        for (n in nuits) {
            val (d, s) = nuitVersJour(n, zone) ?: continue
            if (!dans(d)) continue
            val j = jour(d)
            if ((j.sommeilMin ?: 0) >= (s.sommeilMin ?: 0)) continue
            j.sommeilMin = s.sommeilMin; j.coucher = s.coucher; j.lever = s.lever; j.phases = s.phases
        }

        fun dernier(l: List<Mesure>, poser: (Jour, Double) -> Unit) {
            for ((d, ms) in l.groupBy { date(it.instant) }) {
                if (!dans(d)) continue
                poser(jour(d), ms.maxByOrNull { it.instant }!!.valeur)
            }
        }
        dernier(fcRepos) { j, v -> j.fcRepos = Math.round(v).toInt() }
        dernier(poids) { j, v -> j.poids = Math.round(v * 10) / 10.0 }
        dernier(masseGrasse) { j, v -> j.masseGrasse = Math.round(v * 10) / 10.0 }
        for ((d, ms) in vfcRmssd.groupBy { date(it.instant) }) {
            if (!dans(d)) continue
            val j = jour(d)
            j.vfc = Math.round(ms.map { it.valeur }.average() * 10) / 10.0
            j.vfcMethode = "rmssd"
        }
        return jours
    }

    /** Les jours, par paquets de 14 au plus (les plus anciens d'abord). */
    fun paquets(jours: SortedMap<LocalDate, Jour>, taille: Int = JOURS_PAR_ENVOI): List<SortedMap<LocalDate, Jour>> =
        jours.entries.chunked(taille).map { c -> TreeMap<LocalDate, Jour>().also { m -> c.forEach { m[it.key] = it.value } } }

    // ── LE CORPS JSON ────────────────────────────────────────────────────────
    private fun nombre(x: Double): String {
        require(x.isFinite())
        return if (x == Math.rint(x) && Math.abs(x) < 1e15) x.toLong().toString() else String.format(Locale.ROOT, "%.1f", x)
    }
    private fun chaine(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

    fun jourJson(j: Jour): String {
        val c = mutableListOf<String>()
        j.pas?.let { c += "\"pas\":$it" }
        j.sommeilMin?.let { c += "\"sommeilMin\":$it" }
        j.coucher?.let { c += "\"coucher\":" + chaine(it) }
        j.lever?.let { c += "\"lever\":" + chaine(it) }
        j.phases?.let { c += "\"phases\":{\"profond\":${it.profond},\"leger\":${it.leger},\"paradoxal\":${it.paradoxal},\"eveil\":${it.eveil}}" }
        j.fcRepos?.let { c += "\"fcRepos\":$it" }
        j.vfc?.let { c += "\"vfc\":" + nombre(it) }
        j.vfcMethode?.let { c += "\"vfcMethode\":" + chaine(it) }
        j.poids?.let { c += "\"poids\":" + nombre(it) }
        j.masseGrasse?.let { c += "\"masseGrasse\":" + nombre(it) }
        return "{" + c.joinToString(",") + "}"
    }

    /** Le corps d'un envoi : {v:1, plateforme, source, envoye, jours, origines}. */
    fun corps(jours: Map<LocalDate, Jour>, origines: Map<String, String>, envoye: Long): String {
        val js = jours.entries.joinToString(",") { chaine(it.key.toString()) + ":" + jourJson(it.value) }
        val os = origines.entries.sortedBy { it.key }.joinToString(",") { chaine(it.key) + ":" + chaine(it.value) }
        return "{\"v\":1,\"plateforme\":\"android\",\"source\":\"healthconnect\",\"envoye\":$envoye," +
            "\"jours\":{$js},\"origines\":{$os}}"
    }
}
