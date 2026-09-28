package com.repcore.app.sante

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

// ══ CE QUE L'APK GARDE SUR LE DISQUE, ET RIEN D'AUTRE ══════════════════════
// Le jeton de synchronisation (chiffré, clé dans le Keystore Android) et
// l'heure de la dernière synchronisation réussie. AUCUNE donnée de santé
// n'est écrite : elles passent de Health Connect au serveur en mémoire.
// (allowBackup="false" dans le manifeste : une sauvegarde restaurée sur un
// autre téléphone porterait un fichier que son Keystore ne sait pas ouvrir.)
object Coffre {
    private const val FICHIER = "repcore_sante"
    private const val JETON = "jeton"
    private const val REUSSITE = "derniereReussite"
    private val FORME = Regex("^[A-Za-z0-9_-]{43}$")

    @Volatile private var prefs: SharedPreferences? = null

    private fun ouvrir(ctx: Context): SharedPreferences = prefs ?: synchronized(this) {
        prefs ?: run {
            val app = ctx.applicationContext
            val cle = MasterKey.Builder(app).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            @Suppress("DEPRECATION")
            EncryptedSharedPreferences.create(app, FICHIER, cle,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM).also { prefs = it }
        }
    }

    fun formeValide(jeton: String?) = jeton != null && FORME.matches(jeton)

    fun jeton(ctx: Context): String? = ouvrir(ctx).getString(JETON, null)?.takeIf { formeValide(it) }

    /** Un nouveau jeton efface la date de réussite : la première lecture couvre 30 jours. */
    fun poserJeton(ctx: Context, jeton: String) {
        require(formeValide(jeton))
        ouvrir(ctx).edit().putString(JETON, jeton).remove(REUSSITE).apply()
    }

    fun derniereReussite(ctx: Context): Long? = ouvrir(ctx).getLong(REUSSITE, 0L).takeIf { it > 0 }
    fun reussite(ctx: Context, quand: Long) { ouvrir(ctx).edit().putLong(REUSSITE, quand).apply() }

    fun effacer(ctx: Context) { ouvrir(ctx).edit().clear().apply() }
}
