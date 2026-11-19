package com.rahat.talikhata;

import android.Manifest;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(
    name = "AppUpdater",
    permissions = {
        @Permission(
            strings = { Manifest.permission.POST_NOTIFICATIONS },
            alias = "notifications"
        )
    }
)
public class AppUpdaterPlugin extends Plugin {
    private static final String UPDATE_CHANNEL_ID = "app_updates";
    private static final int UPDATE_NOTIFICATION_ID = 10041;

    private final Map<Long, String> downloadFileNames = new ConcurrentHashMap<>();
    private BroadcastReceiver downloadCompleteReceiver;

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
        registerDownloadReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        if (downloadCompleteReceiver != null) {
            try {
                getContext().unregisterReceiver(downloadCompleteReceiver);
            } catch (IllegalArgumentException ignored) {
            }
            downloadCompleteReceiver = null;
        }
        super.handleOnDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                UPDATE_CHANNEL_ID,
                "অ্যাপ আপডেট বিজ্ঞপ্তি",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("ইবনে সিনা টালিখাতা অ্যাপের নতুন আপডেট নোটিফিকেশন");
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void registerDownloadReceiver() {
        if (downloadCompleteReceiver != null) {
            return;
        }
        downloadCompleteReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) {
                    return;
                }
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (downloadId <= 0) {
                    return;
                }
                JSObject status = queryDownloadStatus(downloadId);
                status.put("downloadId", downloadId);
                notifyListeners("downloadProgress", status);
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        ContextCompat.registerReceiver(
            getContext(),
            downloadCompleteReceiver,
            filter,
            ContextCompat.RECEIVER_EXPORTED
        );
    }

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("versionName", BuildConfig.VERSION_NAME);
        ret.put("versionCode", BuildConfig.VERSION_CODE);
        ret.put("packageName", BuildConfig.APPLICATION_ID);
        ret.put("githubRepo", BuildConfig.GITHUB_REPO);
        call.resolve(ret);
    }

    @PluginMethod
    public void showUpdateNotification(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermCallback");
            return;
        }
        postUpdateNotification(call);
    }

    @PermissionCallback
    private void notificationPermCallback(PluginCall call) {
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            postUpdateNotification(call);
        } else {
            call.resolve();
        }
    }

    private void postUpdateNotification(PluginCall call) {
        createNotificationChannel();
        String title = call.getString("title", "নতুন অ্যাপ আপডেট পাওয়া গেছে");
        String body = call.getString("body", "নতুন ভার্সন ডাউনলোড ও ইনস্টল করতে ট্যাপ করুন।");

        Intent openIntent = new Intent(getContext(), MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            getContext(),
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), UPDATE_CHANNEL_ID)
            .setSmallIcon(getContext().getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(UPDATE_NOTIFICATION_ID, builder.build());
        }
        call.resolve();
    }

    @PluginMethod
    public void startApkDownload(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Download URL is required");
            return;
        }
        String rawFileName = call.getString("fileName", "ibn-sina-talikhata-update.apk");
        String safeFileName = rawFileName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (!safeFileName.endsWith(".apk")) {
            safeFileName = safeFileName + ".apk";
        }
        String title = call.getString("title", "ইবনে সিনা টালিখাতা আপডেট");

        File targetDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (targetDir != null) {
            File existing = new File(targetDir, safeFileName);
            if (existing.exists()) {
                // Remove older file with the same name to prevent duplicate numbering
                existing.delete();
            }
        }

        DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            call.reject("DownloadManager unavailable");
            return;
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle(title);
        request.setDescription("নতুন অ্যাপ আপডেট ডাউনলোড হচ্ছে...");
        request.setMimeType("application/vnd.android.package-archive");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);
        request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, safeFileName);

        long downloadId = dm.enqueue(request);
        downloadFileNames.put(downloadId, safeFileName);

        JSObject ret = new JSObject();
        ret.put("downloadId", downloadId);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDownloadStatus(PluginCall call) {
        Long idLong = call.getLong("downloadId");
        if (idLong == null || idLong <= 0) {
            call.reject("Valid downloadId is required");
            return;
        }
        call.resolve(queryDownloadStatus(idLong));
    }

    private JSObject queryDownloadStatus(long downloadId) {
        JSObject ret = new JSObject();
        DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            ret.put("status", "unknown");
            ret.put("progress", 0);
            ret.put("downloadedBytes", 0);
            ret.put("totalBytes", 0);
            return ret;
        }

        DownloadManager.Query query = new DownloadManager.Query();
        query.setFilterById(downloadId);
        try (Cursor cursor = dm.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) {
                ret.put("status", "unknown");
                ret.put("progress", 0);
                ret.put("downloadedBytes", 0);
                ret.put("totalBytes", 0);
                return ret;
            }
            int statusCol = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            int downloadedCol = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
            int totalCol = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
            int reasonCol = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);

            int dmStatus = statusCol >= 0 ? cursor.getInt(statusCol) : -1;
            long downloaded = downloadedCol >= 0 ? cursor.getLong(downloadedCol) : 0L;
            long total = totalCol >= 0 ? cursor.getLong(totalCol) : 0L;
            int reason = reasonCol >= 0 ? cursor.getInt(reasonCol) : 0;

            String mapped;
            switch (dmStatus) {
                case DownloadManager.STATUS_PENDING:
                    mapped = "pending";
                    break;
                case DownloadManager.STATUS_RUNNING:
                    mapped = "running";
                    break;
                case DownloadManager.STATUS_PAUSED:
                    mapped = "paused";
                    break;
                case DownloadManager.STATUS_SUCCESSFUL:
                    mapped = "successful";
                    break;
                case DownloadManager.STATUS_FAILED:
                    mapped = "failed";
                    break;
                default:
                    mapped = "unknown";
                    break;
            }

            int progress = 0;
            if (mapped.equals("successful")) {
                progress = 100;
            } else if (total > 0) {
                progress = (int) Math.min(99L, Math.max(0L, (downloaded * 100L) / total));
            }

            ret.put("status", mapped);
            ret.put("progress", progress);
            ret.put("downloadedBytes", downloaded);
            ret.put("totalBytes", total);
            if (mapped.equals("failed")) {
                ret.put("reason", "Download failed (code " + reason + ")");
            }
            return ret;
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !getContext().getPackageManager().canRequestPackageInstalls()) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("needsPermission", true);
            call.resolve(ret);
            return;
        }

        Long idLong = call.getLong("downloadId");
        if (idLong == null || idLong <= 0) {
            call.reject("Valid downloadId is required");
            return;
        }

        Uri apkUri = null;
        String fileName = downloadFileNames.get(idLong);
        if (fileName != null) {
            File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir != null) {
                File apkFile = new File(dir, fileName);
                if (apkFile.exists()) {
                    apkUri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        apkFile
                    );
                }
            }
        }

        if (apkUri == null) {
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                apkUri = dm.getUriForDownloadedFile(idLong);
            }
        }

        if (apkUri == null) {
            call.reject("Downloaded APK file could not be located");
            return;
        }

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(installIntent);

        JSObject ret = new JSObject();
        ret.put("started", true);
        ret.put("needsPermission", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void openUnknownSourcesSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }
}
