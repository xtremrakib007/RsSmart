package com.company.salesapp.presentation.components

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.company.salesapp.presentation.theme.SuccessGreen
import com.company.salesapp.presentation.theme.WarningOrange
import com.company.salesapp.presentation.theme.ErrorRed

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesTopBar(title: String, onBack: (() -> Unit)? = null, actions: @Composable RowScope.() -> Unit = {}) {
    TopAppBar(
        title = { Text(title) },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                }
            }
        },
        actions = actions
    )
}

@Composable
fun LoadingIndicator() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

@Composable
fun ErrorMessage(message: String, onRetry: (() -> Unit)? = null) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(Icons.Default.Error, contentDescription = null, tint = ErrorRed, modifier = Modifier.size(48.dp))
        Spacer(modifier = Modifier.height(8.dp))
        Text(message, color = ErrorRed)
        if (onRetry != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = onRetry) { Text("Retry") }
        }
    }
}

@Composable
fun EmptyState(message: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(Icons.Default.Inbox, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(64.dp))
        Spacer(modifier = Modifier.height(16.dp))
        Text(message, style = MaterialTheme.typography.bodyLarge, color = Color.Gray)
    }
}

@Composable
fun StatusBadge(status: String) {
    val (color, text) = when (status.uppercase()) {
        "COMPLETED", "APPROVED", "SYNCED", "HEALTHY", "ONLINE" -> SuccessGreen to status
        "PENDING", "DRAFT", "PROCESSING" -> WarningOrange to status
        "FAILED", "ERROR", "CONFLICT", "OFFLINE" -> ErrorRed to status
        else -> Color.Gray to status
    }
    Surface(color = color.copy(alpha = 0.1f), shape = MaterialTheme.shapes.small) {
        Text(text, color = color, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
fun BottomNavBar(currentRoute: String, onNavigate: (String) -> Unit) {
    NavigationBar {
        val items = listOf(
            Triple("dashboard", Icons.Default.Dashboard, "Dashboard"),
            Triple("customers", Icons.Default.People, "Customers"),
            Triple("orders", Icons.Default.ShoppingCart, "Orders"),
            Triple("visits", Icons.Default.LocationOn, "Visits"),
            Triple("sync_status", Icons.Default.Sync, "Sync")
        )
        items.forEach { (route, icon, label) ->
            NavigationBarItem(
                icon = { Icon(icon, contentDescription = label) },
                label = { Text(label) },
                selected = currentRoute.contains(route),
                onClick = { onNavigate(route) }
            )
        }
    }
}
