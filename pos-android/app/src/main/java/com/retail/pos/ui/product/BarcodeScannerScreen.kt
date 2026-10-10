package com.retail.pos.ui.product

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.retail.pos.viewmodel.CartViewModel
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

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
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> hasCameraPermission = granted }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Scan product barcode") },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Default.Close, contentDescription = "Close scanner")
                    }
                }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (!hasCameraPermission) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Camera permission is required to scan product barcodes.")
                    Button(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                        Text("Allow camera")
                    }
                    TextButton(onClick = onClose) { Text("Back") }
                }
            } else {
                AndroidView(
                    factory = { ctx ->
                        val previewView = PreviewView(ctx)
                        val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                        val scanned = AtomicBoolean(false)
                        val executor = Executors.newSingleThreadExecutor()
                        cameraProviderFuture.addListener({
                            val cameraProvider = cameraProviderFuture.get()
                            val preview = Preview.Builder().build().also {
                                it.setSurfaceProvider(previewView.surfaceProvider)
                            }
                            val analysis = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()
                            val scanner = BarcodeScanning.getClient()
                            analysis.setAnalyzer(executor) { imageProxy ->
                                val mediaImage = imageProxy.image
                                if (mediaImage == null) {
                                    imageProxy.close()
                                } else {
                                    val image = InputImage.fromMediaImage(
                                        mediaImage,
                                        imageProxy.imageInfo.rotationDegrees
                                    )
                                    scanner.process(image)
                                        .addOnSuccessListener { barcodes ->
                                            val code = barcodes.firstNotNullOfOrNull { it.rawValue }
                                            if (code != null && scanned.compareAndSet(false, true)) {
                                                ContextCompat.getMainExecutor(ctx).execute {
                                                    viewModel.setSearchQuery(code)
                                                    onBarcodeScanned(code)
                                                }
                                            }
                                        }
                                        .addOnCompleteListener { imageProxy.close() }
                                }
                            }
                            try {
                                cameraProvider.unbindAll()
                                cameraProvider.bindToLifecycle(
                                    lifecycleOwner,
                                    CameraSelector.DEFAULT_BACK_CAMERA,
                                    preview,
                                    analysis
                                )
                            } catch (_: Exception) {
                                // The permission and scanner UI remain usable if camera hardware is unavailable.
                            }
                        }, ContextCompat.getMainExecutor(ctx))
                        previewView
                    },
                    modifier = Modifier.fillMaxSize()
                )
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    Surface(
                        modifier = Modifier.padding(24.dp),
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
                        shape = MaterialTheme.shapes.medium
                    ) {
                        Text(
                            "Align the barcode inside the camera view",
                            modifier = Modifier.padding(16.dp),
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                }
            }
        }
    }
}
