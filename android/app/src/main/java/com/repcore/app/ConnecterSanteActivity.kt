package com.repcore.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import com.repcore.app.sante.Coffre
import com.repcore.app.sante.PlanifSante
import com.repcore.app.sante.SyncSante
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// ══ « AUTORISER » : LA PAGE → L'APK → HEALTH CONNECT ═══════════════════════
// Ouverte par la feuille « Connecter mes données santé » (lot B) :
//   intent://sante/connecter?jeton=<jeton>#Intent;scheme=repcore;package=com.repcore.app;end
//
// ⚠ N'IMPORTE QUELLE PAGE WEB PEUT OUVRIR CE LIEN. Une page malveillante
//   pourrait y glisser SON jeton et recevoir les données santé de celui qui
//   touche le lien. Avant de ranger quoi que ce soit, l'APK demande donc au
//   serveur le compte lié au jeton (masqué : l•••@gmail.com) et le fait
//   confirmer. Rien n'est lu ni envoyé sans ce « oui ».
//
// Puis : jeton rangé (Coffre, chiffré) → Health Connect installé ? →
// permissions → lecture en arrière-plan si le téléphone la connaît →
// première synchronisation sur 30 jours → retour dans RepCore, Lifestyle.
class ConnecterSanteActivity : ComponentActivity() {

    private lateinit var texte: TextView
    private lateinit var roue: ProgressBar
    private lateinit var bouton: Button
    private lateinit var second: Button
    private var jeton: String? = null
    private var attendInstallation = false

    private val demandePermissions = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()) { accordees ->
        if (SyncSante.PERMISSIONS.none { it in accordees }) {
            afficher("Aucune donnée autorisée : RepCore ne lira rien.\n\nTu peux recommencer depuis Lifestyle quand tu veux.", false)
            proposer("Revenir à RepCore") { rouvrirApp(null) }
        } else demanderArrierePlan()
    }
    private val demandeArrierePlan = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()) { demanderNotifications() }
    private val demandeNotifications = registerForActivityResult(
        ActivityResultContracts.RequestPermission()) { premiereSynchro() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        construireEcran()
        val j = intent?.data?.getQueryParameter("jeton")
        if (intent?.data?.scheme != "repcore" || !Coffre.formeValide(j)) {
            afficher("Ce lien de connexion n'est pas valide. Recommence depuis RepCore > Lifestyle.", false)
            proposer("Revenir à RepCore") { rouvrirApp(null) }
            return
        }
        jeton = j
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
            afficher("La synchronisation automatique demande Android 9 ou plus récent. La saisie et la capture d'écran restent là.", false)
            proposer("Revenir à RepCore") { rouvrirApp(null) }
            return
        }
        confirmerCompte()
    }

    override fun onResume() {
        super.onResume()
        // Retour du Play Store : Health Connect vient peut-être d'être installé.
        if (attendInstallation && SyncSante.statut(this) == HealthConnectClient.SDK_AVAILABLE) {
            attendInstallation = false
            demanderPermissions()
        }
    }

    private fun confirmerCompte() {
        afficher("Vérification du compte…", true)
        lifecycleScope.launch {
            val compte = withContext(Dispatchers.IO) { SyncSante.compteDuJeton(jeton!!) }
            if (compte == null) {
                afficher("Ce lien n'est plus valable (ou le serveur est injoignable). Recommence depuis RepCore > Lifestyle.", false)
                proposer("Revenir à RepCore") { rouvrirApp(null) }
                return@launch
            }
            afficher("Envoyer tes pas, ton sommeil, ta fréquence cardiaque au repos, ta variabilité et ton poids au compte RepCore\n\n$compte\n\nC'est bien le tien ?", false)
            proposer("Oui, c'est mon compte") { Coffre.poserJeton(this@ConnecterSanteActivity, jeton!!); verifierHealthConnect() }
            proposerSecond("Non, annuler") { finish() }
        }
    }

    private fun verifierHealthConnect() {
        when (SyncSante.statut(this)) {
            HealthConnectClient.SDK_AVAILABLE -> demanderPermissions()
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> installerHealthConnect(
                "Health Connect doit être installé ou mis à jour. Le Play Store s'ouvre : installe-le, puis reviens ici.")
            else -> {
                afficher("Health Connect n'est pas disponible sur ce téléphone. La saisie et la capture d'écran restent là.", false)
                proposer("Revenir à RepCore") { rouvrirApp(null) }
            }
        }
    }

    private fun installerHealthConnect(message: String) {
        afficher(message, false)
        proposer("Ouvrir le Play Store") {
            attendInstallation = true
            val uri = Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding")
            try { startActivity(Intent(Intent.ACTION_VIEW, uri).setPackage("com.android.vending")) }
            catch (e: Exception) {
                startActivity(Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata")))
            }
        }
    }

    private fun demanderPermissions() {
        afficher("Android va te demander quelles données partager avec RepCore.", true)
        demandePermissions.launch(SyncSante.PERMISSIONS)
    }

    private fun demanderArrierePlan() {
        lifecycleScope.launch {
            val client = HealthConnectClient.getOrCreate(this@ConnecterSanteActivity)
            val deja = client.permissionController.getGrantedPermissions()
            if (SyncSante.arrierePlanDisponible(client) && SyncSante.PERMISSION_ARRIERE_PLAN !in deja) {
                afficher("Dernière question : autoriser la lecture en arrière-plan, pour que tes nuits arrivent même sans ouvrir RepCore.", true)
                demandeArrierePlan.launch(setOf(SyncSante.PERMISSION_ARRIERE_PLAN))
            } else demanderNotifications()
        }
    }

    // Pour la notification « Mise à jour RepCore disponible » (Android 13+).
    private fun demanderNotifications() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            demandeNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        else premiereSynchro()
    }

    private fun premiereSynchro() {
        afficher("Première synchronisation : les 30 derniers jours…", true)
        lifecycleScope.launch {
            val r = SyncSante.synchroniser(this@ConnecterSanteActivity)
            PlanifSante.planifierPeriodique(this@ConnecterSanteActivity)
            when (r) {
                is SyncSante.Resultat.Ok -> rouvrirApp("ok")
                is SyncSante.Resultat.Revoque -> {
                    afficher("Ce lien a été déconnecté entre-temps. Recommence depuis RepCore > Lifestyle.", false)
                    proposer("Revenir à RepCore") { rouvrirApp(null) }
                }
                else -> {
                    afficher("La première synchronisation n'a pas abouti. Elle sera retentée à la prochaine ouverture de RepCore.", false)
                    proposer("Revenir à RepCore") { rouvrirApp("erreur") }
                }
            }
        }
    }

    private fun rouvrirApp(sante: String?) {
        val url = BuildConfig.SITE + "/app/index.html?apk=" + BuildConfig.VERSION_CODE +
            (if (sante != null) "&sante=$sante" else "") + "#lifestyle"
        startActivity(Intent(this, LauncherActivity::class.java)
            .setAction(Intent.ACTION_VIEW).setData(Uri.parse(url))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP))
        finish()
    }

    // ── L'ÉCRAN : noir, texte blanc, bouton rouge, comme l'app ───────────────
    private fun dp(x: Int) = (x * resources.displayMetrics.density).toInt()

    private fun construireEcran() {
        window.statusBarColor = Color.parseColor("#080808")
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#080808"))
            setPadding(dp(28), dp(28), dp(28), dp(28))
        }
        col.addView(TextView(this).apply {
            text = "RepCore · données santé"
            setTextColor(Color.parseColor("#E02020")); textSize = 13f; letterSpacing = 0.15f
            typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
        })
        texte = TextView(this).apply {
            setTextColor(Color.WHITE); textSize = 17f; gravity = Gravity.CENTER
            setPadding(0, dp(20), 0, dp(20)); setLineSpacing(0f, 1.25f)
        }
        roue = ProgressBar(this)
        bouton = Button(this).apply {
            setBackgroundColor(Color.parseColor("#E02020")); setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD; isAllCaps = false; textSize = 16f
        }
        second = Button(this).apply {
            setBackgroundColor(Color.TRANSPARENT); setTextColor(Color.parseColor("#9a9a9a")); isAllCaps = false
        }
        col.addView(texte)
        col.addView(roue)
        val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)).apply { topMargin = dp(8) }
        col.addView(bouton, lp)
        col.addView(second, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)))
        setContentView(col)
    }

    private fun afficher(t: String, attente: Boolean) {
        texte.text = t
        roue.visibility = if (attente) android.view.View.VISIBLE else android.view.View.GONE
        bouton.visibility = android.view.View.GONE
        second.visibility = android.view.View.GONE
    }
    private fun proposer(lib: String, action: () -> Unit) {
        bouton.text = lib; bouton.visibility = android.view.View.VISIBLE; bouton.setOnClickListener { action() }
    }
    private fun proposerSecond(lib: String, action: () -> Unit) {
        second.text = lib; second.visibility = android.view.View.VISIBLE; second.setOnClickListener { action() }
    }
}
