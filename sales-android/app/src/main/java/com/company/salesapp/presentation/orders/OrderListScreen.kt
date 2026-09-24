package com.company.salesapp.presentation.orders

import androidx.compose.foundation.clickable
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
import com.company.salesapp.data.local.entity.OrderEntity
import com.company.salesapp.presentation.components.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderListScreen(navController: NavController, viewModel: OrderListViewModel = hiltViewModel()) {
    val orders by viewModel.orders.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    Scaffold(
        topBar = { SalesTopBar(title = "Orders", onBack = { navController.popBackStack() }) }
    ) { padding ->
        when {
            isLoading -> LoadingIndicator()
            orders.isEmpty() -> EmptyState("No orders yet")
            else -> LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(orders) { order ->
                    OrderCard(order) { }
                }
            }
        }
    }
}

@Composable
fun OrderCard(order: OrderEntity, onClick: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).clickable(onClick = onClick)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("#${order.id.take(8)}", style = MaterialTheme.typography.labelSmall)
                StatusBadge(order.status)
            }
            Text(order.customerName ?: "Unknown Customer", style = MaterialTheme.typography.titleMedium)
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Total: $${order.total}", style = MaterialTheme.typography.bodyMedium)
                Text(SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date(order.createdAt)), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
