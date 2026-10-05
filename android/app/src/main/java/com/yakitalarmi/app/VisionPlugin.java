package com.yakitalarmi.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.net.Uri;
import android.app.Activity;
import android.content.Intent;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.exifinterface.media.ExifInterface;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.moduleinstall.ModuleInstall;
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashSet;
import java.util.Locale;

@CapacitorPlugin(name = "Vision")
public class VisionPlugin extends Plugin {

    private ActivityResultLauncher<IntentSenderRequest> documentScannerLauncher;
    private PluginCall pendingDocumentCall;

    @Override
    public void load() {
        super.load();
        documentScannerLauncher = getActivity().registerForActivityResult(
                new ActivityResultContracts.StartIntentSenderForResult(),
                this::onDocumentScanResult
        );
    }

    private void onDocumentScanResult(ActivityResult result) {
        PluginCall call = pendingDocumentCall;
        pendingDocumentCall = null;
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Belge taraması iptal edildi.");
            return;
        }
        GmsDocumentScanningResult scanResult = GmsDocumentScanningResult.fromActivityResultIntent(result.getData());
        if (scanResult == null || scanResult.getPages() == null || scanResult.getPages().isEmpty()) {
            call.reject("Belge tarayıcı görüntü döndürmedi.");
            return;
        }
        JSObject response = new JSObject();
        JSArray imageUris = new JSArray();
        for (GmsDocumentScanningResult.Page page : scanResult.getPages()) {
            imageUris.put(page.getImageUri().toString());
        }
        response.put("imageUri", scanResult.getPages().get(0).getImageUri().toString());
        response.put("imageUris", imageUris);
        response.put("pageCount", imageUris.length());
        response.put("scanMode", "document");
        call.resolve(response);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject response = new JSObject();
            response.put("ok", true);
            response.put("target", "application-details-settings");
            call.resolve(response);
        } catch (RuntimeException error) {
            call.reject("Uygulama ayarları açılamadı: " + safeMessage(error), error);
        }
    }

    @PluginMethod
    public void openLocationServices(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject response = new JSObject();
            response.put("ok", true);
            response.put("target", "location-source-settings");
            call.resolve(response);
        } catch (RuntimeException error) {
            call.reject("Cihaz konum ayarları açılamadı: " + safeMessage(error), error);
        }
    }

    @PluginMethod
    public void scanDocument(PluginCall call) {
        if (documentScannerLauncher == null) {
            call.reject("Belge tarayıcı hazır değil.");
            return;
        }
        int pageLimit = Math.max(1, Math.min(3, call.getInt("pageLimit", 1)));
        GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
                .setGalleryImportAllowed(false)
                .setPageLimit(pageLimit)
                .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
                .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
                .build();
        GmsDocumentScanner scanner = GmsDocumentScanning.getClient(options);
        pendingDocumentCall = call;
        scanner.getStartScanIntent(getActivity())
                .addOnSuccessListener(intentSender -> documentScannerLauncher.launch(new IntentSenderRequest.Builder(intentSender).build()))
                .addOnFailureListener(error -> {
                    pendingDocumentCall = null;
                    call.reject("Belge tarayıcı başlatılamadı: " + safeMessage(error), error);
                });
    }

    @PluginMethod
    public void detectText(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null || filename.trim().isEmpty()) {
            call.reject("OCR için görüntü yolu verilmedi.");
            return;
        }

        try {
            Uri uri = toUri(filename);
            InputImage original = InputImage.fromFilePath(getContext(), uri);
            TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            ModuleInstall.getClient(getContext())
                    .installModules(ModuleInstallRequest.newBuilder().addApi(recognizer).build())
                    .addOnSuccessListener(ignored -> processOriginalAndEnhanced(recognizer, original, uri, call))
                    .addOnFailureListener(error -> {
                        recognizer.close();
                        call.reject("OCR modeli indirilemedi. İnterneti ve Google Play Hizmetleri'ni kontrol edin: " + safeMessage(error), error);
                    });
        } catch (IOException | RuntimeException error) {
            call.reject("OCR görüntüsü açılamadı: " + safeMessage(error), error);
        }
    }

    private void processOriginalAndEnhanced(TextRecognizer recognizer, InputImage original, Uri uri, PluginCall call) {
        recognizer.process(original)
                .addOnSuccessListener(primary -> {
                    Bitmap enhanced = null;
                    try {
                        enhanced = createEnhancedBitmap(uri);
                    } catch (IOException | RuntimeException ignored) {
                        // Orijinal görüntü yine de teslim edilir; ikinci geçiş isteğe bağlıdır.
                    }
                    if (enhanced == null) {
                        resolveText(call, recognizer, primary.getText(), "", 1, false, null);
                        return;
                    }
                    final Bitmap enhancedBitmap = enhanced;
                    InputImage enhancedImage = InputImage.fromBitmap(enhancedBitmap, 0);
                    recognizer.process(enhancedImage)
                            .addOnSuccessListener(secondary -> resolveText(call, recognizer, primary.getText(), secondary.getText(), 2, true, enhancedBitmap))
                            .addOnFailureListener(error -> resolveText(call, recognizer, primary.getText(), "", 1, false, enhancedBitmap));
                })
                .addOnFailureListener(error -> {
                    recognizer.close();
                    call.reject("Görüntü metni okunamadı: " + safeMessage(error), error);
                });
    }

    private void resolveText(PluginCall call, TextRecognizer recognizer, String primary, String secondary, int passes, boolean enhanced, Bitmap enhancedBitmap) {
        JSArray detections = new JSArray();
        LinkedHashSet<String> lines = mergedLines(primary, secondary);
        for (String line : lines) {
            JSObject detection = new JSObject();
            detection.put("text", line);
            detections.put(detection);
        }
        JSObject response = new JSObject();
        response.put("text", joinLines(lines));
        response.put("textDetections", detections);
        response.put("passes", passes);
        response.put("enhanced", enhanced);
        if (enhancedBitmap != null && !enhancedBitmap.isRecycled()) enhancedBitmap.recycle();
        recognizer.close();
        call.resolve(response);
    }

    private static LinkedHashSet<String> mergedLines(String primary, String secondary) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        addUniqueLines(result, primary);
        addUniqueLines(result, secondary);
        return result;
    }

    private static void addUniqueLines(LinkedHashSet<String> target, String value) {
        for (String raw : String.valueOf(value == null ? "" : value).split("\\r?\\n")) {
            String line = raw.trim().replaceAll("[ \\t]+", " ");
            if (line.isEmpty()) continue;
            String signature = line.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{Nd}]", "");
            boolean duplicate = false;
            for (String existing : target) {
                String existingSignature = existing.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{Nd}]", "");
                if (signature.equals(existingSignature) || (signature.length() > 8 && existingSignature.contains(signature)) || (existingSignature.length() > 8 && signature.contains(existingSignature))) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) target.add(line);
        }
    }

    private static String joinLines(LinkedHashSet<String> lines) {
        StringBuilder builder = new StringBuilder();
        for (String line : lines) {
            if (builder.length() > 0) builder.append('\n');
            builder.append(line);
        }
        return builder.toString();
    }

    private Bitmap createEnhancedBitmap(Uri uri) throws IOException {
        Bitmap source = null;
        try (InputStream imageStream = getContext().getContentResolver().openInputStream(uri)) {
            if (imageStream == null) throw new IOException("Görüntü akışı açılamadı.");
            source = BitmapFactory.decodeStream(imageStream);
        }
        if (source == null) throw new IOException("Görüntü çözülemedi.");

        int orientation = ExifInterface.ORIENTATION_NORMAL;
        try (InputStream exifStream = getContext().getContentResolver().openInputStream(uri)) {
            if (exifStream != null) orientation = new ExifInterface(exifStream).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
        }
        Bitmap oriented = applyOrientation(source, orientation);
        if (oriented != source) source.recycle();

        final int maxDimension = 2600;
        float scale = Math.min(1f, maxDimension / (float) Math.max(oriented.getWidth(), oriented.getHeight()));
        Bitmap scaled = scale < 1f
                ? Bitmap.createScaledBitmap(oriented, Math.max(1, Math.round(oriented.getWidth() * scale)), Math.max(1, Math.round(oriented.getHeight() * scale)), true)
                : oriented;
        if (scaled != oriented) oriented.recycle();

        Bitmap enhanced = Bitmap.createBitmap(scaled.getWidth(), scaled.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(enhanced);
        ColorMatrix matrix = new ColorMatrix();
        matrix.setSaturation(0f);
        ColorMatrix contrast = new ColorMatrix(new float[]{
                1.22f, 0, 0, 0, -28,
                0, 1.22f, 0, 0, -28,
                0, 0, 1.22f, 0, -28,
                0, 0, 0, 1, 0
        });
        matrix.postConcat(contrast);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        paint.setColorFilter(new ColorMatrixColorFilter(matrix));
        canvas.drawBitmap(scaled, 0, 0, paint);
        if (scaled != oriented) scaled.recycle();
        else scaled.recycle();
        return enhanced;
    }

    private static Bitmap applyOrientation(Bitmap source, int orientation) {
        Matrix matrix = new Matrix();
        switch (orientation) {
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: matrix.setScale(-1, 1); break;
            case ExifInterface.ORIENTATION_ROTATE_180: matrix.setRotate(180); break;
            case ExifInterface.ORIENTATION_FLIP_VERTICAL: matrix.setRotate(180); matrix.postScale(-1, 1); break;
            case ExifInterface.ORIENTATION_TRANSPOSE: matrix.setRotate(90); matrix.postScale(-1, 1); break;
            case ExifInterface.ORIENTATION_ROTATE_90: matrix.setRotate(90); break;
            case ExifInterface.ORIENTATION_TRANSVERSE: matrix.setRotate(-90); matrix.postScale(-1, 1); break;
            case ExifInterface.ORIENTATION_ROTATE_270: matrix.setRotate(-90); break;
            default: return source;
        }
        return Bitmap.createBitmap(source, 0, 0, source.getWidth(), source.getHeight(), matrix, true);
    }

    private static Uri toUri(String filename) {
        Uri uri = Uri.parse(filename);
        return uri.getScheme() == null ? Uri.fromFile(new File(filename)) : uri;
    }

    @PluginMethod
    public void scanBarcode(PluginCall call) {
        GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(
                        Barcode.FORMAT_QR_CODE,
                        Barcode.FORMAT_AZTEC,
                        Barcode.FORMAT_CODE_128,
                        Barcode.FORMAT_EAN_13,
                        Barcode.FORMAT_EAN_8,
                        Barcode.FORMAT_UPC_A,
                        Barcode.FORMAT_UPC_E)
                .enableAutoZoom()
                .build();
        GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(getActivity(), options);
        scanner.startScan()
                .addOnSuccessListener(barcode -> {
                    JSObject response = new JSObject();
                    response.put("rawValue", barcode.getRawValue());
                    response.put("displayValue", barcode.getDisplayValue());
                    response.put("format", barcode.getFormat());
                    response.put("valueType", barcode.getValueType());
                    call.resolve(response);
                })
                .addOnCanceledListener(() -> call.reject("Karekod taraması iptal edildi."))
                .addOnFailureListener(error -> call.reject("Karekod tarayıcı başlatılamadı: " + safeMessage(error), error));
    }

    private static String safeMessage(Exception error) {
        return error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
    }
}
