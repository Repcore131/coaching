package com.repcore.app.sante

import androidx.health.connect.client.records.SleepSessionRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class JoursTest {
    private val paris = ZoneId.of("Europe/Paris")
    private fun t(s: String) = Instant.parse(s)
    private fun d(s: String) = LocalDate.parse(s)

    @Test fun `les constantes recopiées sont celles de Health Connect`() {
        assertEquals(SleepSessionRecord.STAGE_TYPE_UNKNOWN, Jours.HC_INCONNU)
        assertEquals(SleepSessionRecord.STAGE_TYPE_AWAKE, Jours.HC_EVEIL)
        assertEquals(SleepSessionRecord.STAGE_TYPE_SLEEPING, Jours.HC_ENDORMI)
        assertEquals(SleepSessionRecord.STAGE_TYPE_OUT_OF_BED, Jours.HC_HORS_DU_LIT)
        assertEquals(SleepSessionRecord.STAGE_TYPE_LIGHT, Jours.HC_LEGER)
        assertEquals(SleepSessionRecord.STAGE_TYPE_DEEP, Jours.HC_PROFOND)
        assertEquals(SleepSessionRecord.STAGE_TYPE_REM, Jours.HC_PARADOXAL)
        assertEquals(SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED, Jours.HC_EVEIL_AU_LIT)
    }

    @Test fun `les phases, profond, léger, paradoxal, éveil, endormi et inconnu en léger`() {
        assertEquals(Phase.PROFOND, Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_DEEP))
        assertEquals(Phase.LEGER, Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_LIGHT))
        assertEquals(Phase.PARADOXAL, Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_REM))
        assertEquals(Phase.EVEIL, Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_AWAKE))
        assertEquals(Phase.LEGER, Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_SLEEPING))
        assertEquals(Phase.LEGER, Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_UNKNOWN))
        assertEquals(Phase.LEGER, Jours.phaseDe(42))
    }

    @Test fun `la table des marques, et « autre » pour le reste`() {
        assertEquals("garmin", Jours.marque("com.garmin.android.apps.connectmobile"))
        assertEquals("samsung", Jours.marque("com.sec.android.app.shealth"))
        assertEquals("fitbit", Jours.marque("com.fitbit.FitbitMobile"))
        assertEquals("withings", Jours.marque("com.withings.wiscale2"))
        assertEquals("oura", Jours.marque("com.ouraring.oura"))
        assertEquals("polar", Jours.marque("fi.polar.polarflow"))
        assertEquals("autre", Jours.marque("com.google.android.apps.fitness"))
        assertEquals("autre", Jours.marque(null))
        // Chaque marque est une clé de SAN_SOURCES dans l'app (a-z, 2 à 20).
        Jours.MARQUES.values.forEach { assertTrue(it, Regex("^[a-z]{2,20}$").matches(it)) }
    }

    @Test fun `l'origine majoritaire, « autre » ne gagne que seul`() {
        assertEquals("garmin", Jours.origineMajoritaire(listOf("autre", "autre", "garmin")))
        assertEquals("samsung", Jours.origineMajoritaire(listOf("samsung", "samsung", "garmin")))
        assertEquals("autre", Jours.origineMajoritaire(listOf("autre")))
        assertNull(Jours.origineMajoritaire(emptyList()))
    }

    @Test fun `la fenêtre, dernière réussite moins 2 jours, au moins 3, au plus 30`() {
        val auj = d("2026-10-15")
        assertEquals(d("2026-09-16"), Jours.debutFenetre(auj, null))            // 30 jours
        assertEquals(d("2026-10-13"), Jours.debutFenetre(auj, auj))             // 3 jours
        assertEquals(d("2026-10-12"), Jours.debutFenetre(auj, d("2026-10-14")))
        assertEquals(d("2026-10-08"), Jours.debutFenetre(auj, d("2026-10-10")))
        assertEquals(d("2026-09-16"), Jours.debutFenetre(auj, d("2026-01-01")))  // au plus 30
    }

    @Test fun `une nuit à cheval sur minuit va au jour du réveil, avec ses phases`() {
        val n = Nuit(t("2026-10-14T21:10:00Z"), t("2026-10-15T04:52:00Z"), listOf(
            Etape(t("2026-10-14T21:10:00Z"), t("2026-10-14T23:00:00Z"), Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_LIGHT)),
            Etape(t("2026-10-14T23:00:00Z"), t("2026-10-15T00:30:00Z"), Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_DEEP)),
            Etape(t("2026-10-15T00:30:00Z"), t("2026-10-15T00:40:00Z"), Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_AWAKE)),
            Etape(t("2026-10-15T00:40:00Z"), t("2026-10-15T02:00:00Z"), Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_REM)),
            Etape(t("2026-10-15T02:00:00Z"), t("2026-10-15T04:52:00Z"), Jours.phaseDe(SleepSessionRecord.STAGE_TYPE_SLEEPING)),
        ))
        val (jour, j) = Jours.nuitVersJour(n, paris)!!
        assertEquals(d("2026-10-15"), jour)
        assertEquals("23:10", j.coucher); assertEquals("06:52", j.lever)
        assertEquals(110 + 90 + 80 + 172, j.sommeilMin)
        assertEquals(Phases(profond = 90, leger = 282, paradoxal = 80, eveil = 10), j.phases)
    }

    @Test fun `sans phases, la durée de la session, moins de 30 minutes, rien`() {
        val (_, j) = Jours.nuitVersJour(Nuit(t("2026-10-14T21:00:00Z"), t("2026-10-15T05:00:00Z"), emptyList()), paris)!!
        assertEquals(480, j.sommeilMin); assertNull(j.phases)
        assertNull(Jours.nuitVersJour(Nuit(t("2026-10-15T12:00:00Z"), t("2026-10-15T12:20:00Z"), emptyList()), paris))
    }

    @Test fun `deux sessions pour un même réveil, la plus longue`() {
        val nuit = Nuit(t("2026-10-14T21:00:00Z"), t("2026-10-15T04:00:00Z"), emptyList())
        val sieste = Nuit(t("2026-10-15T12:00:00Z"), t("2026-10-15T13:00:00Z"), emptyList())
        val j = Jours.construire(paris, d("2026-10-13"), d("2026-10-15"), nuits = listOf(sieste, nuit))
        assertEquals(420, j[d("2026-10-15")]!!.sommeilMin)
        assertEquals("06:00", j[d("2026-10-15")]!!.lever)
    }

    @Test fun `heure d'été et d'hiver, les jours et les heures du téléphone`() {
        // Nuit du 24 au 25 octobre 2026 : 3 h → 2 h. 23:00+02 → 07:00+01 = 9 h.
        val (jour, j) = Jours.nuitVersJour(Nuit(Instant.parse("2026-10-24T21:00:00Z"), Instant.parse("2026-10-25T06:00:00Z"), emptyList()), paris)!!
        assertEquals(d("2026-10-25"), jour); assertEquals(540, j.sommeilMin)
        assertEquals("23:00", j.coucher); assertEquals("07:00", j.lever)
    }

    @Test fun `FC et poids, la dernière du jour, VFC, la moyenne, méthode rmssd, hors fenêtre écarté`() {
        val j = Jours.construire(paris, d("2026-10-14"), d("2026-10-15"),
            pas = mapOf(d("2026-10-15") to 8123L, d("2026-10-01") to 1L),
            fcRepos = listOf(Mesure(t("2026-10-15T05:00:00Z"), 58.0), Mesure(t("2026-10-15T07:00:00Z"), 54.4)),
            vfcRmssd = listOf(Mesure(t("2026-10-15T02:00:00Z"), 40.0), Mesure(t("2026-10-15T03:00:00Z"), 51.0)),
            poids = listOf(Mesure(t("2026-10-15T06:00:00Z"), 79.46), Mesure(t("2026-10-15T18:00:00Z"), 78.44)),
            masseGrasse = listOf(Mesure(t("2026-10-15T06:00:00Z"), 17.84)))
        assertEquals(setOf(d("2026-10-15")), j.keys)
        val x = j[d("2026-10-15")]!!
        assertEquals(8123L, x.pas); assertEquals(54, x.fcRepos); assertEquals(45.5, x.vfc!!, 0.0)
        assertEquals("rmssd", x.vfcMethode); assertEquals(78.4, x.poids!!, 0.0); assertEquals(17.8, x.masseGrasse!!, 0.0)
    }

    @Test fun `un poids pris à 23 h 30 à Paris reste sur son jour`() {
        val j = Jours.construire(paris, d("2026-10-14"), d("2026-10-15"),
            poids = listOf(Mesure(t("2026-10-14T21:30:00Z"), 80.0)))
        assertEquals(80.0, j[d("2026-10-14")]!!.poids!!, 0.0)
    }

    @Test fun `par paquets de 14 au plus`() {
        val m = java.util.TreeMap<LocalDate, Jour>()
        for (i in 0 until 30) m[d("2026-09-16").plusDays(i.toLong())] = Jour(pas = i.toLong())
        val p = Jours.paquets(m)
        assertEquals(listOf(14, 14, 2), p.map { it.size })
        assertEquals(d("2026-09-16"), p[0].firstKey()); assertEquals(d("2026-10-15"), p[2].lastKey())
    }

    @Test fun `le corps JSON, format rc-sante-1`() {
        val j = sortedMapOf(d("2026-10-15") to Jour(pas = 8123, sommeilMin = 452, coucher = "23:10", lever = "06:52",
            phases = Phases(90, 282, 80, 10), fcRepos = 54, vfc = 45.5, vfcMethode = "rmssd", poids = 78.4, masseGrasse = 17.8),
            d("2026-10-14") to Jour(pas = 0))
        assertEquals("{\"v\":1,\"plateforme\":\"android\",\"source\":\"healthconnect\",\"envoye\":1760000000000," +
            "\"jours\":{\"2026-10-14\":{\"pas\":0},\"2026-10-15\":{\"pas\":8123,\"sommeilMin\":452,\"coucher\":\"23:10\",\"lever\":\"06:52\"," +
            "\"phases\":{\"profond\":90,\"leger\":282,\"paradoxal\":80,\"eveil\":10},\"fcRepos\":54,\"vfc\":45.5,\"vfcMethode\":\"rmssd\"," +
            "\"poids\":78.4,\"masseGrasse\":17.8}},\"origines\":{\"pas\":\"samsung\",\"sommeil\":\"garmin\"}}",
            Jours.corps(j, mapOf("sommeil" to "garmin", "pas" to "samsung"), 1760000000000))
    }
}
