package com.company.salesapp.presentation.visits

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.presentation.components.SalesTopBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisitRecordScreen(navController: NavController, customerId: String, viewModel: VisitRecordViewModel = hiltViewModel()) {
    var notes by remember { mutableStateOf("") }
    val isRecording by viewModel.isRecording.collectAsState()
    val location by viewModel.location.collectAsState()
    val saved by viewModel.saved.collectAsState()

    LaunchedEffect(saved) { if (saved) navController.popBackStack() }
    LaunchedEffect(customerId) { viewModel.startVisit(customerId) }

    Scaffold(topBar = { SalesTopBar(title = "Record Visit", onBack = { navController.popBackStack() }) }) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("GPS Location", style = MaterialTheme.typography.titleMedium)
                    location?.let {
                        Text("Lat: ${it.latitude}")
                        Text("Lng: ${it.longitude}")
                        Text("Accuracy: ${it.accuracy}m")
                    } ?: Text("Acquiring location...", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Visit Notes") }, modifier = Modifier.fillMaxWidth().height(120.dp), maxLines = 4)
            Button(onClick = { viewModel.completeVisit(notes) }, modifier = Modifier.fillMaxWidth(), enabled = !isRecording && location != null) {
                if (isRecording) CircularProgressIndicator(modifier = Modifier.size(20.dp)) else { Icon(Icons.Default.Check, null); Spacer(modifier = Modifier.width(8.dp)); Text("Complete Visit") }
            }
        }
    }
}
