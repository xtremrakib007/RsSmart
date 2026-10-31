package com.company.salesapp.presentation.field

import android.Manifest
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.camera.CameraCapture
import com.company.salesapp.presentation.components.SalesTopBar
import com.company.salesapp.presentation.theme.InfoBlue
import com.company.salesapp.presentation.theme.SuccessGreen
import com.company.salesapp.presentation.theme.WarningOrange
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceScreen(navController: NavController, viewModel: AttendanceViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current
    var showCamera by remember { mutableStateOf(false) }

    val permissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted[Manifest.permission.CAMERA] == true) showCamera = true
        else Toast.makeText(context, "Camera is needed for the attendance selfie", Toast.LENGTH_LONG).show()
    }

    if (showCamera) {
        CameraCapture(
            useFrontCamera = true,
            onImageCaptured = { uri: Uri ->
                showCamera = false
                viewModel.submit(uri.path?.let { File(it) })
            },
            onError = {
                showCamera = false
                Toast.makeText(context, "Camera not available — saving without a photo", Toast.LENGTH_LONG).show()
                viewModel.submit(null)
            }
        )
        return
    }

    Scaffold(topBar = { SalesTopBar(title = "Attendance", onBack = { navController.popBackStack() }) }) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (state.loading) { CircularProgressIndicator(); return@Column }
            val (label, color) = when (state.status) {
                "IN" -> "Working now" to SuccessGreen
                "OUT" -> "Day finished" to InfoBlue
                else -> "Not checked in yet" to WarningOrange
            }
            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.12f))) {
                Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(if (state.status == "NOT_IN") Icons.Default.Login else Icons.Default.Timer, null, tint = color, modifier = Modifier.size(40.dp))
                    Spacer(Modifier.height(8.dp))
                    Text(label, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = color)
                    state.checkInAt?.let { Text("In: ${timeOf(it)}", style = MaterialTheme.typography.bodyMedium) }
                    state.checkOutAt?.let { Text("Out: ${timeOf(it)}", style = MaterialTheme.typography.bodyMedium) }
                    if (state.status != "NOT_IN") Text("Worked ${formatMinutes(state.minutesWorked)}", style = MaterialTheme.typography.bodyMedium)
                }
            }
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            state.message?.let { Text(it, color = SuccessGreen, fontWeight = FontWeight.SemiBold) }
            if (state.status != "OUT") {
                Button(
                    onClick = { permissions.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) },
                    enabled = !state.busy,
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                ) {
                    if (state.busy) CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                    else {
                        Icon(Icons.Default.PhotoCamera, null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (state.status == "NOT_IN") "Check in with selfie" else "Check out with selfie")
                    }
                }
                Text("Your selfie and location are saved with the time.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

/** "2026-10-31T08:05:00.000Z" → local "08:05". */
internal fun timeOf(iso: String): String = runCatching {
    val instant = java.time.Instant.parse(iso)
    java.time.format.DateTimeFormatter.ofPattern("HH:mm").withZone(java.time.ZoneId.systemDefault()).format(instant)
}.getOrDefault(iso)
