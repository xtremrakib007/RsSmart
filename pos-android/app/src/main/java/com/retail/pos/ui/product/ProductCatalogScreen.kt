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

private fun formatMyr(value: Double): String = "RM " + String.format(Locale.US, "%.2f", value)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductCatalogScreen(
    onNavigateToCart: () -> Unit,
    onCheckout: () -> Unit,
    onScanBarcode: () -> Unit,
    scannedBarcode: String = "",
    onBarcodeHandled: () -> Unit = {},
    viewModel: CartViewModel = hiltViewModel()
) {
    val products by viewModel.products.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val itemCount by viewModel.itemCount.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    var showPriceCheck by remember { mutableStateOf(false) }
    var selectedPriceProduct by remember { mutableStateOf<Product?>(null) }

    LaunchedEffect(scannedBarcode) {
        if (scannedBarcode.isNotBlank()) {
            viewModel.setSearchQuery(scannedBarcode)
            onBarcodeHandled()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("RsSmart POS") },
                actions = {
                    IconButton(onClick = onScanBarcode) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = "Scan barcode")
                    }
                    IconButton(onClick = { showPriceCheck = true; selectedPriceProduct = null }) {
                        Icon(Icons.Default.PriceCheck, contentDescription = "Price check")
                    }
                    BadgedBox(badge = { if (itemCount > 0) Badge { Text(itemCount.toString()) } }) {
                        IconButton(onClick = onNavigateToCart) {
                            Icon(Icons.Default.ShoppingCart, contentDescription = "Cart")
                        }
                    }
                }
            )
        },
        bottomBar = {
            if (itemCount > 0) {
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
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                placeholder = { Text("Search product, SKU, or barcode") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotBlank()) IconButton(onClick = { viewModel.setSearchQuery("") }) {
                        Icon(Icons.Default.Clear, contentDescription = "Clear search")
                    }
                },
                singleLine = true
            )
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onScanBarcode, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Scan item")
                }
                OutlinedButton(onClick = { showPriceCheck = true; selectedPriceProduct = null }, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.PriceCheck, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Price check")
                }
            }
            if (products.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Inventory2, contentDescription = null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.outline)
                        Spacer(Modifier.height(8.dp))
                        Text(if (searchQuery.isBlank()) "No products synced yet" else "No product matches this search")
                        Text("Import or sync your store's product catalogue to start selling.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
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
                            onAdd = { viewModel.addToCart(product) }
                        )
                    }
                }
            }
        }
    }

    if (showPriceCheck) {
        AlertDialog(
            onDismissRequest = { showPriceCheck = false; selectedPriceProduct = null },
            title = { Text("Price check") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = viewModel::setSearchQuery,
                        label = { Text("Product name, SKU or barcode") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (selectedPriceProduct != null) {
                        Text(selectedPriceProduct!!.name, style = MaterialTheme.typography.titleMedium)
                        Text(formatMyr(selectedPriceProduct!!.unitPrice), style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
                        Text("SKU: ${selectedPriceProduct!!.sku}", style = MaterialTheme.typography.bodySmall)
                        Text("Stock: ${selectedPriceProduct!!.stockQuantity} ${selectedPriceProduct!!.unitOfMeasure}", style = MaterialTheme.typography.bodySmall)
                        TextButton(onClick = { selectedPriceProduct = null }) { Text("Choose another product") }
                    } else {
                        products.take(5).forEach { product ->
                            TextButton(onClick = { selectedPriceProduct = product }, modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.fillMaxWidth()) {
                                    Text(product.name, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("${formatMyr(product.unitPrice)} · ${product.sku}", color = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                        if (products.isEmpty()) Text("No matching product found.")
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showPriceCheck = false; selectedPriceProduct = null }) { Text("Done") } }
        )
    }
}

@Composable
fun ProductCard(product: Product, cartQty: Double, onAdd: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(product.name, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(product.sku, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(formatMyr(product.unitPrice), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                if (cartQty > 0) Badge(containerColor = MaterialTheme.colorScheme.secondary) {
                    Text("${cartQty.toInt()} in cart", color = MaterialTheme.colorScheme.onSecondary)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = onAdd, modifier = Modifier.fillMaxWidth(), enabled = product.stockQuantity > 0) {
                Text(if (product.stockQuantity > 0) "Add to Cart" else "Out of Stock")
            }
        }
    }
}
