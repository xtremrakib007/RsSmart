package com.retail.pos.ui.product

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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.viewmodel.CartViewModel
import com.retail.shared.data.local.entity.Product
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductCatalogScreen(
    onNavigateToCart: () -> Unit,
    onCheckout: () -> Unit,
    onNavigateToScanner: () -> Unit,
    onBarcodeScanned: (String) -> Unit,
    viewModel: CartViewModel = hiltViewModel()
) {
    val products by viewModel.products.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val itemCount by viewModel.itemCount.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    var priceCheckMode by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (priceCheckMode) "Price Check" else "RsSmart POS · Products") },
                actions = {
                    IconButton(onClick = onNavigateToScanner) {
                        Icon(Icons.Default.CameraAlt, contentDescription = "Scan product barcode")
                    }
                    BadgedBox(badge = { if (itemCount > 0 && !priceCheckMode) Badge { Text(itemCount.toString()) } }) {
                        IconButton(onClick = onNavigateToCart, enabled = !priceCheckMode) {
                            Icon(Icons.Default.ShoppingCart, contentDescription = "Cart")
                        }
                    }
                }
            )
        },
        bottomBar = {
            if (itemCount > 0 && !priceCheckMode) {
                BottomAppBar {
                    Button(onClick = onCheckout, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                        Text("Checkout ($itemCount items)")
                    }
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = viewModel::setSearchQuery,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Search product name, SKU, or barcode") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotBlank()) IconButton(onClick = { viewModel.setSearchQuery("") }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear search")
                    }
                },
                singleLine = true
            )
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onNavigateToScanner, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.CameraAlt, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Scan barcode")
                }
                OutlinedButton(onClick = { priceCheckMode = !priceCheckMode }, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.PriceCheck, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (priceCheckMode) "Exit price check" else "Price check")
                }
            }
            if (priceCheckMode) {
                Text("Price-check mode: look up an item without accidentally adding it to the sale.", modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            }
            if (products.isEmpty()) {
                Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Inventory2, contentDescription = null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.outline)
                        Text(if (searchQuery.isBlank()) "No products loaded" else "No product matches “$searchQuery”", style = MaterialTheme.typography.titleMedium)
                        Text("Add products to inventory and sync them to this device.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (searchQuery.isNotBlank()) TextButton(onClick = { viewModel.setSearchQuery("") }) { Text("Clear search") }
                    }
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 160.dp),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(products, key = { it.id }) { product ->
                        ProductCard(
                            product = product,
                            cartQty = cartItems.find { it.productId == product.id }?.quantity ?: 0.0,
                            priceCheckMode = priceCheckMode,
                            onAdd = { viewModel.addToCart(product) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ProductCard(product: Product, cartQty: Double, priceCheckMode: Boolean, onAdd: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(product.name, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("SKU: ${product.sku}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
            Spacer(modifier = Modifier.height(8.dp))
            Text("RM ${"%.2f".format(Locale.US, product.unitPrice)}", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
            if (!priceCheckMode && cartQty > 0) {
                Spacer(Modifier.height(4.dp))
                Badge(containerColor = MaterialTheme.colorScheme.secondary) { Text("${cartQty.toInt()} in cart", color = MaterialTheme.colorScheme.onSecondary) }
            }
            Spacer(modifier = Modifier.height(8.dp))
            if (priceCheckMode) {
                Text(if (product.stockQuantity > 0) "In stock: ${product.stockQuantity}" else "Out of stock", style = MaterialTheme.typography.bodyMedium, color = if (product.stockQuantity > 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
            } else {
                Button(onClick = onAdd, modifier = Modifier.fillMaxWidth(), enabled = product.stockQuantity > 0) {
                    Text(if (product.stockQuantity > 0) "Add to cart" else "Out of stock")
                }
            }
        }
    }
}
