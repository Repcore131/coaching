package com.repcore.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// ══ LA MISE À JOUR, SANS PLAY STORE ═════════════════════════════════════════
// Au lancement, l'APK lit <site>/app/apk-version.json ({versionCode, url,
// notes}). S'il existe une version plus récente que la sienne, une
// notification « Mise à jour RepCore disponible » ouvre l'url (la page
// aide-apk.html, qui mène à la release GitHub). Rien n'est installé tout seul.
object MiseAJour {
    private const val CANAL = "maj"
    private const val ID = 4201

    @JvmStatic
    fun verifierEnFond(ctx: Context) {
        val app = ctx.applicationContext
        Thread { try { verifier(app) } catch (_: Exception) {} }.start()
    }

    private fun verifier(ctx: Context) {
        val c = URL(BuildConfig.SITE + "/app/apk-version.json").openConnection() as HttpURLConnection
        val j = try {
            c.connectTimeout = 10000; c.readTimeout = 10000
            c.setRequestProperty("Cache-Control", "no-cache")
            if (c.responseCode != 200) return
            JSONObject(c.inputStream.bufferedReader().use { it.readText() })
        } finally { c.disconnect() }
        val v = j.optInt("versionCode", 0)
        val url = j.optString("url", "")
        if (v <= BuildConfig.VERSION_CODE || !url.startsWith("https://")) return
        notifier(ctx, v, url)
    }

    private fun notifier(ctx: Context, v: Int, url: String) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(NotificationChannel(CANAL, "Mises à jour", NotificationManager.IMPORTANCE_DEFAULT))
        val ouvrir = PendingIntent.getActivity(ctx, 0, Intent(Intent.ACTION_VIEW, Uri.parse(url)),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        @Suppress("DEPRECATION")
        val b = if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, CANAL) else android.app.Notification.Builder(ctx)
        val n = b.setSmallIcon(R.drawable.ic_notif_maj)
            .setContentTitle("Mise à jour RepCore disponible")
            .setContentText("Version $v : touche pour la télécharger.")
            .setContentIntent(ouvrir)
            .setAutoCancel(true)
            .build()
        nm.notify(ID, n)
    }
}
