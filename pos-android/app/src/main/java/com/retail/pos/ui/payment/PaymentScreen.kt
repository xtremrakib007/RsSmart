package com.retail.pos.ui.payment

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.service.printer.PrintService
import com.retail.pos.viewmodel.PaymentViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentScreen(
    orderId: String,
    onDone: () -> Unit,
    viewModel: PaymentViewModel = hiltViewModel()
) {
    val order by viewModel.order.collectAsState()
    val printState by viewModel.printState.collectAsState()

    LaunchedEffect(orderId) {
        viewModel.loadOrder(orderId)
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Payment Complete") }) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                Icons.Default.CheckCircle,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text("Payment Successful!", style = MaterialTheme.typography.headlineMedium)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Receipt: ${order?.receiptNumber ?: "N/A"}", style = MaterialTheme.typography.titleMedium)
            Text("Total: RM ${"%.2f".format(order?.grandTotal ?: 0.0)}", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
            Spacer(modifier = Modifier.height(32.dp))

            if (printState is PrintService.PrintState.Printing) {
                CircularProgressIndicator()
                Spacer(modifier = Modifier.height(8.dp))
                Text("Printing receipt...")
            } else if (printState is PrintService.PrintState.Error) {
                Text(
                    "Print failed: ${(printState as PrintService.PrintState.Error).message}",
                    color = MaterialTheme.colorScheme.error
                )
            } else if (printState is PrintService.PrintState.Success) {
                Text("Receipt printed successfully", color = MaterialTheme.colorScheme.secondary)
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = { viewModel.printReceipt() },
                modifier = Modifier.fillMaxWidth(),
                enabled = printState !is PrintService.PrintState.Printing
            ) {
                Icon(Icons.Default.Print, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Print Receipt")
            }

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedButton(
                onClick = onDone,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("New Sale")
            }
        }
    }
}
