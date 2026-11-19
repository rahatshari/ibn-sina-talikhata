package com.rahat.talikhata;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private OnBackPressedCallback backCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(GoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);

        backCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    performDefaultBack();
                    return;
                }
                webView.evaluateJavascript(
                    "(function(){ try { return typeof window.__handleAndroidBack === 'function' ? window.__handleAndroidBack() : 'exit'; } catch(e) { return 'exit'; } })()",
                    value -> {
                        if ("\"handled\"".equals(value)) {
                            return;
                        }
                        if (!isFinishing() && !isDestroyed()) {
                            performDefaultBack();
                        }
                    }
                );
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backCallback);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (backCallback != null) {
            backCallback.setEnabled(true);
        }
    }

    private void performDefaultBack() {
        if (backCallback != null) {
            backCallback.setEnabled(false);
        }
        getOnBackPressedDispatcher().onBackPressed();
        if (backCallback != null) {
            backCallback.setEnabled(true);
        }
    }
}
