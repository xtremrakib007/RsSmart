package com.company.salesapp.presentation.customers

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
import com.company.salesapp.data.local.entity.CustomerEntity
import com.company.salesapp.presentation.components.*
import com.company.salesapp.presentation.navigation.Screen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerListScreen(navController: NavController, viewModel: CustomerListViewModel = hiltViewModel()) {
    val customers by viewModel.customers.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var showFilter by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            SalesTopBar(title = "Customers", onBack = { navController.popBackStack() })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { navController.navigate(Screen.CustomerForm.createRoute()) }) {
                Icon(Icons.Default.Add, contentDescription = "Add Customer")
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { 
                    searchQuery = it
                    viewModel.search(it)
                },
                label = { Text("Search customers...") },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                singleLine = true
            )

            when {
                isLoading -> LoadingIndicator()
                customers.isEmpty() -> EmptyState("No customers found")
                else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(customers) { customer ->
                        CustomerCard(customer) {
                            navController.navigate(Screen.CustomerDetail.createRoute(customer.id))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CustomerCard(customer: CustomerEntity, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).clickable(onClick = onClick)
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(modifier = Modifier.weight(1f)) {
                Text(customer.name, style = MaterialTheme.typography.titleMedium)
                if (!customer.phone.isNullOrBlank()) {
                    Text(customer.phone, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (!customer.city.isNullOrBlank()) {
                    Text(customer.city, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Column(horizontalAlignment = androidx.compose.ui.Alignment.End) {
                StatusBadge(if (customer.isSynced) "SYNCED" else "PENDING")
                if (!customer.category.isNullOrBlank()) {
                    Text(customer.category, style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}
