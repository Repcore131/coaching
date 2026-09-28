package com.repcore.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

// L'ÉCRAN DE JUSTIFICATION EXIGÉ PAR HEALTH CONNECT : « pourquoi RepCore lit
// ces données ». Il ouvre la politique de confidentialité, qui le dit (voir
// « Synchronisation automatique (Health Connect, Apple Santé) »).
// Déclenché par ACTION_SHOW_PERMISSIONS_RATIONALE (Android 13 et moins) et,
// sur Android 14+, par l'alias VIEW_PERMISSION_USAGE / HEALTH_PERMISSIONS.
class JustificationSanteActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.SITE + "/privacy.html"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: Exception) {}
        finish()
    }
}
