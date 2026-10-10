package com.retail.pos.ui.product

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
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
    var showAddProduct by remember { mutableStateOf(false) }
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
                    IconButton(onClick = { showAddProduct = true }, enabled = !priceCheckMode) {
                        Icon(Icons.Default.AddBox, contentDescription = "Add product")
                    }
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
                    "PRICE CHECK • Scan or search to see the shelf price without adding items to the sale.",
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
                        Text("Add a product to start testing the register.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                        if (!priceCheckMode) {
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = { showAddProduct = true }) { Text("Add first product") }
                        }
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

    if (showAddProduct) {
        ProductCreateDialog(
            onDismiss = { showAddProduct = false },
            onSave = { name, sku, barcode, price, cost, stock, taxPercent, unit, done ->
                viewModel.createProduct(name, sku, barcode, price, cost, stock, taxPercent, unit, done)
            }
        )
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

@Composable
private fun ProductCreateDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String?, Double, Double?, Double, Double, String, (String?) -> Unit) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var sku by remember { mutableStateOf("") }
    var barcode by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var cost by remember { mutableStateOf("") }
    var stock by remember { mutableStateOf("0") }
    var tax by remember { mutableStateOf("0") }
    var unit by remember { mutableStateOf("PCS") }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!saving) onDismiss() },
        title = { Text("Add product") },
        text = {
            Column {
                Text("Product details are stored on this device. Backend product sync must be configured before using this for live multi-device inventory.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(name, { name = it }, label = { Text("Product name *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(sku, { sku = it }, label = { Text("SKU / PLU *") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(barcode, { barcode = it }, label = { Text("Barcode (optional)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(price, { price = it }, label = { Text("Selling price (RM) *") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(cost, { cost = it }, label = { Text("Cost price (RM, optional)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(stock, { stock = it }, label = { Text("Opening stock") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(tax, { tax = it }, label = { Text("Tax rate (%) — configure for your business") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(unit, { unit = it }, label = { Text("Unit (PCS, KG, L)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                if (error != null) {
                    Spacer(Modifier.height(6.dp))
                    Text(error!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !saving,
                onClick = {
                    val parsedPrice = price.toDoubleOrNull()
                    val parsedCost = cost.takeIf { it.isNotBlank() }?.toDoubleOrNull()
                    val parsedStock = stock.toDoubleOrNull()
                    val parsedTax = tax.toDoubleOrNull()
                    if (name.isBlank() || sku.isBlank() || parsedPrice == null || parsedStock == null || parsedTax == null ||
                        (cost.isNotBlank() && parsedCost == null)) {
                        error = "Enter a name, SKU, valid price, stock and tax rate."
                    } else {
                        saving = true
                        onSave(name, sku, barcode, parsedPrice, parsedCost, parsedStock, parsedTax, unit) { result ->
                            saving = false
                            if (result == null) onDismiss() else error = result
                        }
                    }
                }
            ) { if (saving) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Save product") }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !saving) { Text("Cancel") } }
    )
}
