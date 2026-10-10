package com.retail.pos.ui.product

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.retail.pos.viewmodel.CartViewModel
import java.util.concurrent.Executors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BarcodeScannerScreen(
    onBarcodeScanned: (String) -> Unit,
    onClose: () -> Unit,
    viewModel: CartViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var hasCameraPermission by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    var permissionDenied by remember { mutableStateOf(false) }
    var scanned by remember { mutableStateOf(false) }
    var lastBarcode by remember { mutableStateOf("") }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasCameraPermission = granted
        permissionDenied = !granted
    }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text("Scan Barcode") },
            navigationIcon = { IconButton(onClick = onClose) { Icon(Icons.Default.Close, contentDescription = "Close") } }
        )
    }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            if (hasCameraPermission) {
                AndroidView(
                    factory = { ctx ->
                        val previewView = PreviewView(ctx)
                        val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                        cameraProviderFuture.addListener({
                            val cameraProvider = cameraProviderFuture.get()
                            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
                            val imageAnalysis = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()
                            val scanner = BarcodeScanning.getClient()
                            val executor = Executors.newSingleThreadExecutor()
                            imageAnalysis.setAnalyzer(executor) { imageProxy ->
                                val mediaImage = imageProxy.image
                                if (mediaImage == null) {
                                    imageProxy.close()
                                } else {
                                    val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                                    scanner.process(image)
                                        .addOnSuccessListener { barcodes ->
                                            for (barcode in barcodes) {
                                                val code = barcode.rawValue
                                                if (!code.isNullOrBlank() && !scanned && code != lastBarcode) {
                                                    lastBarcode = code
                                                    scanned = true
                                                    onBarcodeScanned(code)
                                                    break
                                                }
                                            }
                                        }
                                        .addOnCompleteListener { imageProxy.close() }
                                }
                            }
                            try {
                                cameraProvider.unbindAll()
                                cameraProvider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, imageAnalysis)
                            } catch (_: Exception) {
                                // The permission and scanner UI remain available if the camera cannot start.
                            }
                        }, ContextCompat.getMainExecutor(ctx))
                        previewView
                    },
                    modifier = Modifier.fillMaxSize()
                )
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Surface(color = MaterialTheme.colorScheme.scrim.copy(alpha = 0.65f), shape = MaterialTheme.shapes.medium) {
                        Text("Align barcode within frame", color = MaterialTheme.colorScheme.inverseOnSurface, modifier = Modifier.padding(16.dp))
                    }
                }
            } else {
                Column(
                    Modifier.fillMaxSize().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("Camera access is needed to scan product barcodes.", style = MaterialTheme.typography.titleMedium)
                    if (permissionDenied) {
                        Spacer(Modifier.height(8.dp))
                        Text("Allow camera access in Android app settings if you previously denied it.", color = MaterialTheme.colorScheme.error)
                    }
                    Spacer(Modifier.height(16.dp))
                    Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) { Text("Allow camera") }
                }
            }
        }
    }
}
