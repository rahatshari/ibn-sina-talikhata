package com.rahat.talikhata;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "GoogleAuthBridge")
public class GoogleAuthPlugin extends Plugin {
    private static final String FALLBACK_WEB_CLIENT_ID =
        "30985726414-9t20a5f812n20kdpbik2tb2u03vnbbuq.apps.googleusercontent.com";

    private volatile GoogleSignInClient cachedClient;

    @Override
    public void load() {
        super.load();
        getOrCreateClient();
    }

    private synchronized GoogleSignInClient getOrCreateClient() {
        if (cachedClient != null) {
            return cachedClient;
        }
        String webClientId = FALLBACK_WEB_CLIENT_ID;
        int resId = getContext().getResources().getIdentifier(
            "default_web_client_id",
            "string",
            getContext().getPackageName()
        );
        if (resId != 0) {
            String resolved = getContext().getString(resId);
            if (resolved != null && !resolved.trim().isEmpty()) {
                webClientId = resolved.trim();
            }
        }

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(webClientId)
            .requestEmail()
            .build();
        cachedClient = GoogleSignIn.getClient(getContext(), gso);
        return cachedClient;
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        GoogleSignInClient client = getOrCreateClient();
        Intent signInIntent = client.getSignInIntent();
        startActivityForResult(call, signInIntent, "handleSignInResult");
    }

    @PluginMethod
    public void silentSignIn(PluginCall call) {
        GoogleSignInClient client = getOrCreateClient();
        client.silentSignIn().addOnCompleteListener(task -> {
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                if (account == null || account.getIdToken() == null) {
                    call.reject("No cached Google account");
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("idToken", account.getIdToken());
                ret.put("email", account.getEmail() != null ? account.getEmail() : "");
                ret.put("displayName", account.getDisplayName() != null ? account.getDisplayName() : "");
                call.resolve(ret);
            } catch (ApiException e) {
                call.reject("Silent sign-in unavailable: " + e.getStatusCode(), e);
            }
        });
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result.getResultCode() == Activity.RESULT_CANCELED && result.getData() == null) {
            call.reject("Google Sign-In canceled by user");
            return;
        }
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(result.getData());
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account == null || account.getIdToken() == null) {
                call.reject("Missing Google ID token. Check SHA-1 fingerprint in Firebase Console.");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("idToken", account.getIdToken());
            ret.put("email", account.getEmail() != null ? account.getEmail() : "");
            ret.put("displayName", account.getDisplayName() != null ? account.getDisplayName() : "");
            call.resolve(ret);
        } catch (ApiException e) {
            call.reject("Google Sign-In failed with code: " + e.getStatusCode(), e);
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        GoogleSignInClient client = getOrCreateClient();
        client.signOut().addOnCompleteListener(task -> call.resolve());
    }
}
