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
    viewModel: CartViewModel = hiltViewModel()
) {
    val products by viewModel.products.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val itemCount by viewModel.itemCount.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()

    // Session ID now comes from CartViewModel, which reads it from PosSessionProvider —
    // the same active session SessionViewModel opened, no per-screen placeholder needed.

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Product Catalog") },
                actions = {
                    IconButton(onClick = onScanBarcode) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = "Scan barcode")
                    }
                    IconButton(onClick = onPriceCheck) {
                        Icon(Icons.Default.PriceCheck, contentDescription = "Price check")
                    }
                    BadgedBox(
                        badge = {
                            if (itemCount > 0) {
                                Badge { Text(itemCount.toString()) }
                            }
                        }
                    ) {
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
                    Button(
                        onClick = onCheckout,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)
                    ) {
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
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                placeholder = { Text("Search by name, SKU, or barcode...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true
            )

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

@Composable
fun ProductCard(
    product: Product,
    cartQty: Double,
    onAdd: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = product.name,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = product.sku,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.outline
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "$${"%.2f".format(product.unitPrice)}",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                if (cartQty > 0) {
                    Badge(containerColor = MaterialTheme.colorScheme.secondary) {
                        Text("${cartQty.toInt()} in cart", color = MaterialTheme.colorScheme.onSecondary)
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onAdd,
                modifier = Modifier.fillMaxWidth(),
                enabled = product.stockQuantity > 0
            ) {
                Text(if (product.stockQuantity > 0) "Add to Cart" else "Out of Stock")
            }
        }
    }
}
