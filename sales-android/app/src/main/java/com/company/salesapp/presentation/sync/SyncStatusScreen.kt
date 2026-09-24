package com.company.salesapp.presentation.sync

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.presentation.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncStatusScreen(navController: NavController, viewModel: SyncStatusViewModel = hiltViewModel()) {
    val pendingCount by viewModel.pendingCount.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val lastResult by viewModel.lastResult.collectAsState()
    val isOnline by viewModel.isOnline.collectAsState()
    Scaffold(topBar = { SalesTopBar(title = "Sync Status", onBack = { navController.popBackStack() }) }) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (isOnline) Icons.Default.CloudDone else Icons.Default.CloudOff, null, tint = if (isOnline) com.company.salesapp.presentation.theme.SuccessGreen else com.company.salesapp.presentation.theme.ErrorRed)
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text(if (isOnline) "Online" else "Offline", style = MaterialTheme.typography.titleMedium)
                        Text("Last sync: ${lastResult?.message ?: "Never"}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Pending Events", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("$pendingCount events waiting to sync", style = MaterialTheme.typography.bodyLarge)
                }
            }
            Button(onClick = { viewModel.syncNow() }, modifier = Modifier.fillMaxWidth(), enabled = !isSyncing && isOnline) {
                if (isSyncing) { CircularProgressIndicator(modifier = Modifier.size(20.dp), color = MaterialTheme.colorScheme.onPrimary); Spacer(modifier = Modifier.width(8.dp)) }
                Text(if (isSyncing) "Syncing..." else "Sync Now")
            }
            lastResult?.let { result ->
                val color = if (result.success) com.company.salesapp.presentation.theme.SuccessGreen else com.company.salesapp.presentation.theme.ErrorRed
                Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.1f))) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(if (result.success) "Sync Successful" else "Sync Failed", color = color, style = MaterialTheme.typography.titleMedium)
                        Text(result.message, color = color)
                        if (result.success) Text("Pushed: ${result.pushed}, Pulled: ${result.pulled}", color = color, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}
