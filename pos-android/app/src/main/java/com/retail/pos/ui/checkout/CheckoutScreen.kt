package com.retail.pos.ui.checkout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.viewmodel.CheckoutViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutScreen(
    onBack: () -> Unit,
    onPaymentComplete: (String) -> Unit,
    viewModel: CheckoutViewModel = hiltViewModel()
) {
    val cartItems by viewModel.cartItems.collectAsState()
    val subtotal by viewModel.subtotal.collectAsState()
    val totalTax by viewModel.totalTax.collectAsState()
    val grandTotal by viewModel.grandTotal.collectAsState()
    val checkoutState by viewModel.checkoutState.collectAsState()

    var customerName by remember { mutableStateOf("") }

    // Session ID now comes from PosSessionProvider via the ViewModel — no placeholder needed.

    LaunchedEffect(checkoutState) {
        if (checkoutState is CheckoutViewModel.CheckoutState.Success) {
            val success = checkoutState as CheckoutViewModel.CheckoutState.Success
            viewModel.resetState()
            onPaymentComplete(success.orderId)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Checkout") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).padding(16.dp)) {
            // Order summary
            Card(modifier = Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Order Summary", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyColumn(modifier = Modifier.heightIn(max = 200.dp)) {
                        items(cartItems) { item ->
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("${item.productName} x${item.quantity.toInt()}")
                                Text("RM ${"%.2f".format(item.lineTotal)}")
                            }
                        }
                    }
                    Divider(modifier = Modifier.padding(vertical = 8.dp))
                    SummaryRow("Subtotal", subtotal)
                    SummaryRow("Tax", totalTax)
                    Divider(modifier = Modifier.padding(vertical = 4.dp))
                    SummaryRow("Grand Total", grandTotal, isTotal = true)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = customerName,
                onValueChange = { customerName = it },
                label = { Text("Customer Name (optional)") },
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) }
            )

            Spacer(modifier = Modifier.height(24.dp))

            if (checkoutState is CheckoutViewModel.CheckoutState.Error) {
                Text(
                    (checkoutState as CheckoutViewModel.CheckoutState.Error).message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            Button(
                onClick = { viewModel.processCheckout(null, customerName.takeIf { it.isNotBlank() }) },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                enabled = checkoutState !is CheckoutViewModel.CheckoutState.Processing
            ) {
                if (checkoutState is CheckoutViewModel.CheckoutState.Processing) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Text("Confirm & Pay", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}

@Composable
fun SummaryRow(label: String, amount: Double, isTotal: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            label,
            style = if (isTotal) MaterialTheme.typography.titleLarge else MaterialTheme.typography.bodyLarge
        )
        Text(
            "RM ${"%.2f".format(amount)}",
            style = if (isTotal) MaterialTheme.typography.titleLarge else MaterialTheme.typography.bodyLarge,
            color = if (isTotal) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
        )
    }
}
