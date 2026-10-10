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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductCatalogScreen(
    onNavigateToCart: () -> Unit,
    onCheckout: () -> Unit,
    viewModel: CartViewModel = hiltViewModel()
) {
    val products by viewModel.products.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val itemCount by viewModel.itemCount.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    var showScanner by remember { mutableStateOf(false) }
    var priceCheckMode by remember { mutableStateOf(false) }

    if (showScanner) {
        BarcodeScannerScreen(
            onBarcodeScanned = { barcode ->
                viewModel.setSearchQuery(barcode)
                showScanner = false
                priceCheckMode = true
            },
            onClose = { showScanner = false }
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (priceCheckMode) "Price Check" else "New Sale") },
                actions = {
                    TextButton(onClick = { priceCheckMode = !priceCheckMode }) {
                        Text(if (priceCheckMode) "Back to sale" else "Price check")
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
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                placeholder = { Text("Search product, SKU or barcode") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    IconButton(onClick = { showScanner = true }) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = "Scan barcode")
                    }
                },
                singleLine = true
            )
            if (priceCheckMode) {
                Text(
                    "PRICE CHECK  •  Scan or search to see the shelf price without adding items to the sale.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
            if (products.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Inventory2, contentDescription = null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.outline)
                        Spacer(Modifier.height(8.dp))
                        Text(if (searchQuery.isBlank()) "No products loaded for this outlet" else "No product found")
                        Text("Check your product catalogue and sync connection.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
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
fun ProductCard(product: Product, cartQty: Double, priceCheckMode: Boolean = false, onAdd: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(product.name, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("SKU: ${product.sku}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
            if (!product.barcode.isNullOrBlank()) {
                Text("Barcode: ${product.barcode}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(8.dp))
            Text("RM ${String.format(java.util.Locale.US, "%.2f", product.unitPrice)}", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
            Text("Stock: ${product.stockQuantity} ${product.unitOfMeasure}", style = MaterialTheme.typography.bodySmall)
            if (cartQty > 0 && !priceCheckMode) {
                Spacer(Modifier.height(4.dp))
                Badge(containerColor = MaterialTheme.colorScheme.secondary) { Text("${cartQty.toInt()} in cart", color = MaterialTheme.colorScheme.onSecondary) }
            }
            if (!priceCheckMode) {
                Spacer(Modifier.height(8.dp))
                Button(onClick = onAdd, modifier = Modifier.fillMaxWidth(), enabled = product.stockQuantity > 0) {
                    Text(if (product.stockQuantity > 0) "Add to sale" else "Out of stock")
                }
            }
        }
    }
}
