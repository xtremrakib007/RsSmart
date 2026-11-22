package com.company.salesapp.presentation.dashboard

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.presentation.components.SalesTopBar
import com.company.salesapp.presentation.navigation.Screen
import com.company.salesapp.presentation.theme.InfoBlue
import com.company.salesapp.presentation.theme.SuccessGreen
import com.company.salesapp.presentation.theme.WarningOrange

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(navController: NavController, viewModel: DashboardViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    val pendingSync by viewModel.pendingSyncCount.collectAsState()
    val isOnline by viewModel.isOnline.collectAsState()

    val isManager by viewModel.isManager.collectAsState()
    val config by viewModel.config.collectAsState()
    val context = LocalContext.current
    // Every tile the app has; the server's settings choose which show and in what order.
    val allItems = mapOf(
        "attendance" to MenuItem("Attendance", Icons.Default.Fingerprint, Screen.Attendance.route, SuccessGreen),
        "today" to MenuItem("Today's Route", Icons.Default.Map, Screen.Today.route, InfoBlue),
        "nearby" to MenuItem("Nearby", Icons.Default.NearMe, Screen.Nearby.route, WarningOrange),
        "team" to MenuItem("Team", Icons.Default.Groups, Screen.TeamAttendance.route, InfoBlue),
        "customers" to MenuItem("Customers", Icons.Default.People, Screen.Customers.route, InfoBlue),
        "orders" to MenuItem("Orders", Icons.Default.ShoppingCart, Screen.Orders.route, SuccessGreen),
        "visits" to MenuItem("Visits", Icons.Default.LocationOn, Screen.Visits.route, WarningOrange),
        "collections" to MenuItem("Collections", Icons.Default.Payments, Screen.Collections.route, InfoBlue),
        "expenses" to MenuItem("Expenses", Icons.Default.Receipt, Screen.Expenses.route, WarningOrange),
        "sync" to MenuItem("Sync", Icons.Default.Sync, Screen.SyncStatus.route, SuccessGreen),
    )
    val menuItems = config.menu
        .filter { it != "team" || isManager }
        .mapNotNull { allItems[it] } +
        listOfNotNull(if (config.canEditSettings) MenuItem("App Settings", Icons.Default.Settings, Screen.AppSettings.route, InfoBlue) else null)
    val money = { v: Double -> "${config.currency} ${"%.2f".format(v)}" }

    var updateDismissed by rememberSaveable { mutableStateOf(false) }
    if (config.updateStatus != "NONE" && config.apkUrl.isNotBlank() && (config.updateStatus == "REQUIRED" || !updateDismissed)) {
        val required = config.updateStatus == "REQUIRED"
        AlertDialog(
            onDismissRequest = { if (!required) updateDismissed = true },
            title = { Text(if (required) "Update required" else "Update available") },
            text = {
                Text(config.updateNotes.ifBlank {
                    if (required) "This version is no longer supported. Install the new version to continue." else "A new version of the app is ready."
                })
            },
            confirmButton = {
                TextButton(onClick = {
                    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(config.apkUrl))) }
                }) { Text("Download") }
            },
            dismissButton = { if (!required) TextButton(onClick = { updateDismissed = true }) { Text("Later") } }
        )
    }

    Scaffold(
        topBar = {
            SalesTopBar(
                title = "Dashboard",
                actions = {
                    if (!isOnline) {
                        Badge { Text("OFFLINE") }
                    }
                    if (pendingSync > 0) {
                        BadgedBox(badge = { Badge { Text("$pendingSync") } }) {
                            IconButton(onClick = { navController.navigate(Screen.SyncStatus.route) }) {
                                Icon(Icons.Default.Sync, contentDescription = "Sync")
                            }
                        }
                    }
                    IconButton(onClick = { viewModel.logout() }) {
                        Icon(Icons.Default.Logout, contentDescription = "Logout")
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (config.noticeText.isNotBlank()) NoticeBanner(config.noticeText, config.noticeLevel)
            // KPI Cards
            Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                KpiCard("Today's Orders", state.todayOrders.toString(), SuccessGreen, modifier = Modifier.weight(1f))
                KpiCard("Revenue", money(state.todayRevenue), InfoBlue, modifier = Modifier.weight(1f))
            }
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                KpiCard("Visits", state.todayVisits.toString(), WarningOrange, modifier = Modifier.weight(1f))
                KpiCard("Collections", money(state.todayCollections), SuccessGreen, modifier = Modifier.weight(1f))
            }

            Spacer(modifier = Modifier.height(16.dp))
            Text("Quick Actions", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(modifier = Modifier.height(8.dp))

            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(menuItems) { item ->
                    MenuCard(item) { navController.navigate(item.route) }
                }
            }
        }
    }
}

/** A message the admin sets on the server (Settings → notice). */
@Composable
fun NoticeBanner(text: String, level: String) {
    val color = when (level) { "urgent" -> MaterialTheme.colorScheme.error; "warning" -> WarningOrange; else -> InfoBlue }
    Card(
        modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp),
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.12f))
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(if (level == "info") Icons.Default.Info else Icons.Default.Warning, contentDescription = null, tint = color)
            Spacer(modifier = Modifier.width(8.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
fun KpiCard(title: String, value: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.1f))) {
        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, style = MaterialTheme.typography.labelSmall, color = color)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, color = color)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MenuCard(item: MenuItem, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth().aspectRatio(1.5f)) {
        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(item.icon, contentDescription = item.title, tint = item.color, modifier = Modifier.size(40.dp))
            Spacer(modifier = Modifier.height(8.dp))
            Text(item.title, style = MaterialTheme.typography.titleMedium)
        }
    }
}

data class MenuItem(val title: String, val icon: ImageVector, val route: String, val color: androidx.compose.ui.graphics.Color)
