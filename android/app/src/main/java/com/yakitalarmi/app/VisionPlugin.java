package com.yakitalarmi.app;

import android.net.Uri;

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
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.File;
import java.io.IOException;

@CapacitorPlugin(name = "Vision")
public class VisionPlugin extends Plugin {

    @PluginMethod
    public void detectText(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null || filename.trim().isEmpty()) {
            call.reject("OCR için görüntü yolu verilmedi.");
            return;
        }

        try {
            Uri uri = Uri.parse(filename);
            if (uri.getScheme() == null) {
                uri = Uri.fromFile(new File(filename));
            }
            InputImage image = InputImage.fromFilePath(getContext(), uri);
            TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            ModuleInstall.getClient(getContext())
                    .installModules(ModuleInstallRequest.newBuilder().addApi(recognizer).build())
                    .addOnSuccessListener(ignored -> processImage(recognizer, image, call))
                    .addOnFailureListener(error -> {
                        recognizer.close();
                        call.reject("OCR modeli indirilemedi. İnterneti ve Google Play Hizmetleri'ni kontrol edin: " + safeMessage(error), error);
                    });
        } catch (IOException | RuntimeException error) {
            call.reject("OCR görüntüsü açılamadı: " + safeMessage(error), error);
        }
    }

    private void processImage(TextRecognizer recognizer, InputImage image, PluginCall call) {
        recognizer.process(image)
                .addOnSuccessListener(result -> {
                    JSArray detections = new JSArray();
                    for (Text.TextBlock block : result.getTextBlocks()) {
                        for (Text.Line line : block.getLines()) {
                            JSObject detection = new JSObject();
                            detection.put("text", line.getText());
                            detections.put(detection);
                        }
                    }
                    JSObject response = new JSObject();
                    response.put("text", result.getText());
                    response.put("textDetections", detections);
                    recognizer.close();
                    call.resolve(response);
                })
                .addOnFailureListener(error -> {
                    recognizer.close();
                    call.reject("Görüntü metni okunamadı: " + safeMessage(error), error);
                });
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
