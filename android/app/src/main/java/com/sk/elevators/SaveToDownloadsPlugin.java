package com.sk.elevators;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Saves a file directly into the device's public Downloads folder.
 *
 * On Android 10+ (API 29+) this uses the MediaStore API, which needs no
 * storage permission at all — the whole point of scoped storage is that
 * apps can contribute to shared collections like Downloads without needing
 * broad filesystem access. Below API 29, MediaStore.Downloads doesn't exist,
 * so it falls back to a direct file write into the public Downloads
 * directory, which requires the (dangerous, runtime-requested) legacy
 * WRITE_EXTERNAL_STORAGE permission on API 23-28.
 */
@CapacitorPlugin(
    name = "SaveToDownloads",
    permissions = {
        @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = "storage")
    }
)
public class SaveToDownloadsPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveViaMediaStore(call);
            return;
        }
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "legacySaveCallback");
            return;
        }
        saveViaLegacyFile(call);
    }

    @PermissionCallback
    private void legacySaveCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            saveViaLegacyFile(call);
        } else {
            call.reject("Storage permission is required to save to Downloads on this Android version.");
        }
    }

    private void saveViaMediaStore(PluginCall call) {
        String base64Data = call.getString("data");
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType", "application/pdf");
        if (base64Data == null || filename == null) {
            call.reject("data and filename are required");
            return;
        }
        try {
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            Context context = getContext();
            ContentResolver resolver = context.getContentResolver();

            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

            Uri itemUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (itemUri == null) {
                call.reject("Could not create file entry in Downloads");
                return;
            }
            try (OutputStream out = resolver.openOutputStream(itemUri)) {
                if (out == null) {
                    call.reject("Could not open output stream for Downloads file");
                    return;
                }
                out.write(bytes);
            }

            JSObject ret = new JSObject();
            ret.put("uri", itemUri.toString());
            ret.put("filename", filename);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save file to Downloads: " + e.getMessage(), e);
        }
    }

    private void saveViaLegacyFile(PluginCall call) {
        String base64Data = call.getString("data");
        String filename = call.getString("filename");
        if (base64Data == null || filename == null) {
            call.reject("data and filename are required");
            return;
        }
        try {
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!downloadsDir.exists()) downloadsDir.mkdirs();
            File file = new File(downloadsDir, filename);
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
            }

            JSObject ret = new JSObject();
            ret.put("uri", Uri.fromFile(file).toString());
            ret.put("filename", filename);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to save file to Downloads: " + e.getMessage(), e);
        }
    }
}
