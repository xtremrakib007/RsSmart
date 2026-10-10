package com.company.salesapp.camera

import android.content.Context
import android.net.Uri
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.Executor
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

@Composable
fun CameraCapture(onImageCaptured: (Uri) -> Unit, onError: (Exception) -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var imageCapture: ImageCapture? by remember { mutableStateOf(null) }
    var preview by remember { mutableStateOf<Preview?>(null) }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                val previewView = PreviewView(ctx)
                val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                cameraProviderFuture.addListener({
                    val cameraProvider = cameraProviderFuture.get()
                    preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
                    imageCapture = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build()
                    val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
                    try {
                        cameraProvider.unbindAll()
                        cameraProvider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, imageCapture)
                    } catch (e: Exception) { onError(e) }
                }, ContextCompat.getMainExecutor(ctx))
                previewView
            }
        )
        FloatingActionButton(
            onClick = {
                val ic = imageCapture ?: return@FloatingActionButton
                val photoFile = createFile(context)
                val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()
                ic.takePicture(outputOptions, ContextCompat.getMainExecutor(context), object : ImageCapture.OnImageSavedCallback {
                    override fun onError(exc: ImageCaptureException) { onError(exc) }
                    override fun onImageSaved(output: ImageCapture.OutputFileResults) { onImageCaptured(Uri.fromFile(photoFile)) }
                })
            },
            modifier = Modifier.fillMaxSize().padding(bottom = 32.dp).wrapContentSize(androidx.compose.ui.Alignment.BottomCenter)
        ) { Icon(Icons.Default.Camera, contentDescription = "Take Photo") }
    }
}

private fun createFile(context: Context): File {
    val dir = File(context.getExternalFilesDir(null), "receipts").apply { mkdirs() }
    return File(dir, "IMG_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())}.jpg")
}
