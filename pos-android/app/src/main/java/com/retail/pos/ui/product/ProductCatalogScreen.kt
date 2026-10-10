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
    onScanBarcode: () -> Unit,
    onPriceCheck: () -> Unit,
    scannedBarcode: String,
    onScannedBarcodeHandled: () -> Unit,
    viewModel: CartViewModel = hiltViewModel()
) {
    val products by viewModel.products.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val itemCount by viewModel.itemCount.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    var priceCheckMode by remember { mutableStateOf(false) }

    LaunchedEffect(scannedBarcode) {
        if (scannedBarcode.isNotBlank()) {
            viewModel.setSearchQuery(scannedBarcode)
            onScannedBarcodeHandled()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (priceCheckMode) "Price Check" else "RsSmart POS") },
                actions = {
                    IconButton(onClick = onNavigateToCart) {
                        BadgedBox(badge = { if (itemCount > 0) Badge { Text(itemCount.toString()) } }) {
                            Icon(Icons.Default.ShoppingCart, contentDescription = "Cart")
                        }
                    }
                }
            )
        },
        bottomBar = {
            if (itemCount > 0 && !priceCheckMode) {
                BottomAppBar {
                    Button(
                        onClick = onCheckout,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                    ) { Text("Checkout ($itemCount items)") }
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { priceCheckMode = false; onScanBarcode() },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Scan item")
                }
                OutlinedButton(
                    onClick = { priceCheckMode = true; onPriceCheck() },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Search, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Price check")
                }
            }

            OutlinedTextField(
                value = searchQuery,
                onValueChange = viewModel::setSearchQuery,
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                placeholder = { Text("Search name, SKU, or barcode") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotBlank()) {
                        IconButton(onClick = { viewModel.setSearchQuery("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear search")
                        }
                    }
                },
                singleLine = true
            )

            if (priceCheckMode) {
                Text(
                    "Price-check mode: look up an item to view its current price without adding it to the sale.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
                    color = MaterialTheme.colorScheme.secondary
                )
            }

            if (products.isEmpty()) {
                Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text(
                        if (searchQuery.isBlank()) "No products are loaded yet. Sync or add products to this outlet first."
                        else "No product found for “$searchQuery”. Check the barcode, SKU, or product name.",
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 160.dp),
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(products, key = { it.id }) { product ->
                        ProductCard(
                            product = product,
                            cartQty = cartItems.find { it.productId == product.id }?.quantity ?: 0.0,
                            showAddToCart = !priceCheckMode,
                            onAdd = { viewModel.addToCart(product) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ProductCard(
    product: Product,
    cartQty: Double,
    showAddToCart: Boolean = true,
    onAdd: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(product.name, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("SKU: ${product.sku}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
            Spacer(Modifier.height(8.dp))
            Text(
                "RM " + String.format(java.util.Locale.US, "%.2f", product.unitPrice),
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.primary
            )
            Text("Stock: ${product.stockQuantity}", style = MaterialTheme.typography.bodySmall)
            if (showAddToCart && cartQty > 0) {
                Spacer(Modifier.height(6.dp))
                Badge(containerColor = MaterialTheme.colorScheme.secondary) {
                    Text("${cartQty.toInt()} in cart", color = MaterialTheme.colorScheme.onSecondary)
                }
            }
            Spacer(Modifier.height(8.dp))
            if (showAddToCart) {
                Button(
                    onClick = onAdd,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = product.stockQuantity > 0
                ) { Text(if (product.stockQuantity > 0) "Add to cart" else "Out of stock") }
            } else {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.small
                ) {
                    Text("Price only", modifier = Modifier.padding(10.dp), style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}
