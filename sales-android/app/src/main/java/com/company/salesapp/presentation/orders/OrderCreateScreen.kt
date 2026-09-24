package com.company.salesapp.presentation.orders

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
import com.company.salesapp.data.local.entity.ProductEntity
import com.company.salesapp.presentation.components.SalesTopBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderCreateScreen(navController: NavController, customerId: String, viewModel: OrderCreateViewModel = hiltViewModel()) {
    val products by viewModel.products.collectAsState()
    val cart by viewModel.cart.collectAsState()
    val customer by viewModel.customer.collectAsState()
    var showProductSheet by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }

    LaunchedEffect(customerId) { viewModel.loadCustomer(customerId) }

    Scaffold(
        topBar = { SalesTopBar(title = "New Order", onBack = { navController.popBackStack() }) },
        bottomBar = {
            Surface(shadowElevation = 8.dp) {
                Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("Total: $${cart.total}", style = MaterialTheme.typography.titleLarge)
                        Text("${cart.items.size} items", style = MaterialTheme.typography.bodySmall)
                    }
                    Button(onClick = { viewModel.submitOrder() }) {
                        Icon(Icons.Default.Check, null)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Submit")
                    }
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            customer?.let {
                Card(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    ListItem(headlineContent = { Text(it.name) }, supportingContent = { Text(it.phone ?: "") }, leadingContent = { Icon(Icons.Default.Person, null) })
                }
            }
            if (cart.items.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = androidx.compose.ui.Alignment.Center) {
                    Text("Tap + to add products", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(modifier = Modifier.weight(1f)) {
                    items(cart.items) { item ->
                        ListItem(
                            headlineContent = { Text(item.productName) },
                            supportingContent = { Text("${item.quantity} x $${item.unitPrice} = $${item.total}") },
                            trailingContent = {
                                IconButton(onClick = { viewModel.removeItem(item.productId) }) {
                                    Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error)
                                }
                            }
                        )
                    }
                }
            }
        }
    }

    if (showProductSheet) {
        ModalBottomSheet(onDismissRequest = { showProductSheet = false }) {
            Column(modifier = Modifier.padding(16.dp)) {
                OutlinedTextField(value = searchQuery, onValueChange = { searchQuery = it; viewModel.searchProducts(it) }, label = { Text("Search products...") }, leadingIcon = { Icon(Icons.Default.Search, null) }, modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
                LazyColumn {
                    items(products) { product ->
                        var qty by remember { mutableStateOf("1") }
                        ListItem(
                            headlineContent = { Text(product.name) },
                            supportingContent = { Text("$${product.basePrice} | ${product.sku}") },
                            trailingContent = {
                                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                                    OutlinedTextField(value = qty, onValueChange = { qty = it }, modifier = Modifier.width(60.dp), singleLine = true)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    IconButton(onClick = { viewModel.addToCart(product, qty.toDoubleOrNull() ?: 1.0); showProductSheet = false }) {
                                        Icon(Icons.Default.Add, null)
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}
