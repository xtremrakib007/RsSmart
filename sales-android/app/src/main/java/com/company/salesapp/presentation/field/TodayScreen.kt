package com.company.salesapp.presentation.field

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.presentation.components.EmptyState
import com.company.salesapp.presentation.components.ErrorMessage
import com.company.salesapp.presentation.components.SalesTopBar
import com.company.salesapp.presentation.navigation.Screen

/** Today's route(s): the customers to visit, ticked off as they are visited. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(navController: NavController, viewModel: TodayViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    // Back from a visit: show it ticked.
    LaunchedEffect(Unit) { viewModel.refresh() }

    Scaffold(topBar = {
        SalesTopBar(title = "Today's route", onBack = { navController.popBackStack() }, actions = {
            IconButton(onClick = { viewModel.refresh() }) { Icon(Icons.Default.Refresh, "Refresh") }
        })
    }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            val t = state.today
            when {
                state.loading && t == null -> CircularProgressIndicator(Modifier.padding(24.dp))
                state.error != null && t == null -> ErrorMessage(state.error!!) { viewModel.refresh() }
                t != null -> LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (t.attendance.status == "NOT_IN") item {
                        Card(onClick = { navController.navigate(Screen.Attendance.route) }, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                            Row(Modifier.padding(14.dp)) {
                                Icon(Icons.Default.Login, null); Spacer(Modifier.width(8.dp))
                                Text("You haven't checked in yet — tap to check in", fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                    if (t.routes.isEmpty()) item {
                        EmptyState("No route planned for today. Use Nearby to see the customers around you.")
                    }
                    t.routes.forEach { r ->
                        item(key = "h_" + r.id) {
                            Column(Modifier.padding(top = 6.dp)) {
                                Text(r.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                                Text("${r.visited} of ${r.stops.size} visited", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                LinearProgressIndicator(
                                    progress = if (r.stops.isEmpty()) 0f else r.visited.toFloat() / r.stops.size,
                                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp)
                                )
                            }
                        }
                        // Not yet visited first.
                        items(r.stops.sortedBy { it.visitedAt != null }, key = { r.id + "_" + it.id }) { c ->
                            FieldCustomerCard(c, navController, showDistance = false)
                        }
                    }
                }
            }
        }
    }
}
