/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.repcore.app;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;



public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    

    

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
        // REPCORE : la synchronisation Health Connect (WorkManager, en tâche de
        // fond : la fenêtre ne l'attend pas) et la recherche d'une version plus
        // récente de l'APK. Aucune des deux ne peut empêcher l'ouverture.
        try { com.repcore.app.sante.PlanifSante.lancerMaintenant(this); } catch (Exception e) { }
        try { MiseAJour.verifierEnFond(this); } catch (Exception e) { }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();

        // REPCORE : ?apk=<versionCode>. La page le range dans localStorage
        // (rc_apk) : c'est ainsi que la feuille « Connecter mes données santé »
        // sait qu'elle tourne dans l'APK et propose « Autoriser ».
        if (uri != null && uri.getQueryParameter("apk") == null) {
            uri = uri.buildUpon()
                    .appendQueryParameter("apk", String.valueOf(BuildConfig.VERSION_CODE))
                    .build();
        }
        return uri;
    }
}
