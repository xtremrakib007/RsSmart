package com.company.salesapp.presentation.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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

    val menuItems = listOf(
        MenuItem("Customers", Icons.Default.People, Screen.Customers.route, InfoBlue),
        MenuItem("Orders", Icons.Default.ShoppingCart, Screen.Orders.route, SuccessGreen),
        MenuItem("Visits", Icons.Default.LocationOn, Screen.Visits.route, WarningOrange),
        MenuItem("Collections", Icons.Default.Payments, Screen.Collections.route, InfoBlue),
        MenuItem("Expenses", Icons.Default.Receipt, Screen.Expenses.route, WarningOrange),
        MenuItem("Sync", Icons.Default.Sync, Screen.SyncStatus.route, SuccessGreen),
    )

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
            // KPI Cards
            Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                KpiCard("Today's Orders", state.todayOrders.toString(), SuccessGreen, modifier = Modifier.weight(1f))
                KpiCard("Revenue", "$${state.todayRevenue}", InfoBlue, modifier = Modifier.weight(1f))
            }
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                KpiCard("Visits", state.todayVisits.toString(), WarningOrange, modifier = Modifier.weight(1f))
                KpiCard("Collections", "$${state.todayCollections}", SuccessGreen, modifier = Modifier.weight(1f))
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
