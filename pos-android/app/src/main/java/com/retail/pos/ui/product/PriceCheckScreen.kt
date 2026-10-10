package com.retail.pos.ui.product

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.viewmodel.CartViewModel
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PriceCheckScreen(
    onScanBarcode: () -> Unit,
    onBack: () -> Unit,
    viewModel: CartViewModel = hiltViewModel()
) {
    val products by viewModel.products.collectAsState()
    val query by viewModel.searchQuery.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Price Check") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.Search, contentDescription = "Back to checkout")
                    }
                },
                actions = {
                    IconButton(onClick = onScanBarcode) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = "Scan product barcode")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = query,
                onValueChange = viewModel::setSearchQuery,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Product name, SKU or barcode") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true
            )
            if (query.isBlank()) {
                Text("Search or scan a barcode to check the current selling price and stock.")
            } else if (products.isEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("No matching product", style = MaterialTheme.typography.titleMedium)
                        Text("No local catalog item matches “$query”. Sync the product catalog or check the barcode.")
                    }
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(products, key = { it.id }) { product ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(product.name, style = MaterialTheme.typography.titleMedium)
                                    Text("SKU: ${product.sku}", style = MaterialTheme.typography.bodySmall)
                                    product.barcode?.takeIf { it.isNotBlank() }?.let {
                                        Text("Barcode: $it", style = MaterialTheme.typography.bodySmall)
                                    }
                                    Text("Stock: ${String.format(Locale.US, "%.3f", product.stockQuantity)} ${product.unitOfMeasure}")
                                }
                                Text(
                                    "RM ${String.format(Locale.US, "%.2f", product.unitPrice)}",
                                    style = MaterialTheme.typography.titleLarge,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
