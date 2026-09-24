package com.company.salesapp.presentation.visits

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.presentation.components.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisitListScreen(navController: NavController, viewModel: VisitListViewModel = hiltViewModel()) {
    val visits by viewModel.visits.collectAsState()
    Scaffold(topBar = { SalesTopBar(title = "My Visits", onBack = { navController.popBackStack() }) }) { padding ->
        if (visits.isEmpty()) EmptyState("No visits recorded yet")
        else LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            items(visits) { visit ->
                Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Customer: ${visit.customerId.take(8)}", style = MaterialTheme.typography.titleMedium)
                            StatusBadge(if (visit.isSynced) "SYNCED" else "PENDING")
                        }
                        Text("Check-in: ${SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault()).format(Date(visit.checkInAt))}")
                        visit.checkOutAt?.let { Text("Check-out: ${SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(it))}") }
                        visit.notes?.let { Text("Notes: $it", style = MaterialTheme.typography.bodySmall) }
                    }
                }
            }
        }
    }
}
