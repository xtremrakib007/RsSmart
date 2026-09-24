package com.company.salesapp.presentation.customers

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.presentation.components.*
import com.company.salesapp.presentation.navigation.Screen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerDetailScreen(navController: NavController, customerId: String, viewModel: CustomerDetailViewModel = hiltViewModel()) {
    val customer by viewModel.customer.collectAsState()
    val visits by viewModel.visits.collectAsState()

    LaunchedEffect(customerId) {
        viewModel.loadCustomer(customerId)
    }

    Scaffold(
        topBar = {
            SalesTopBar(
                title = customer?.name ?: "Customer",
                onBack = { navController.popBackStack() },
                actions = {
                    IconButton(onClick = { navController.navigate(Screen.CustomerForm.createRoute(customerId)) }) {
                        Icon(Icons.Default.Edit, contentDescription = "Edit")
                    }
                }
            )
        },
        floatingActionButton = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FloatingActionButton(
                    onClick = { navController.navigate(Screen.VisitRecord.createRoute(customerId)) },
                    containerColor = MaterialTheme.colorScheme.secondary
                ) {
                    Icon(Icons.Default.LocationOn, contentDescription = "Record Visit")
                }
                FloatingActionButton(onClick = { navController.navigate(Screen.OrderCreate.createRoute(customerId)) }) {
                    Icon(Icons.Default.ShoppingCart, contentDescription = "New Order")
                }
            }
        }
    ) { padding ->
        customer?.let { c ->
            Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        InfoRow("Phone", c.phone ?: "-")
                        InfoRow("Email", c.email ?: "-")
                        InfoRow("Address", listOfNotNull(c.address, c.city, c.state).joinToString(", ").ifEmpty { "-" })
                        InfoRow("Category", c.category ?: "-")
                        InfoRow("Credit Limit", c.creditLimit?.let { "$$it" } ?: "-")
                        InfoRow("Balance", "$$${c.balance}")
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text("Recent Visits", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                if (visits.isEmpty()) {
                    Text("No visits recorded", color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else {
                    visits.take(3).forEach { visit ->
                        ListItem(
                            headlineContent = { Text(java.text.SimpleDateFormat("MMM dd, yyyy HH:mm").format(java.util.Date(visit.checkInAt))) },
                            supportingContent = { visit.notes?.let { Text(it) } },
                            leadingContent = { Icon(Icons.Default.LocationOn, null) }
                        )
                    }
                }
            }
        } ?: LoadingIndicator()
    }
}

@Composable
fun InfoRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label, modifier = Modifier.weight(0.4f), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        Text(value, modifier = Modifier.weight(0.6f), style = MaterialTheme.typography.bodyMedium)
    }
}
