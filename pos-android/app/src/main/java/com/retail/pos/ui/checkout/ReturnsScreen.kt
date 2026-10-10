package com.retail.pos.ui.checkout

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.viewmodel.ReturnsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReturnsScreen(
    onBack: () -> Unit,
    onRefundComplete: () -> Unit,
    viewModel: ReturnsViewModel = hiltViewModel()
) {
    val refundState by viewModel.refundState.collectAsState()
    var receiptNumber by remember { mutableStateOf("") }
    var refundAmount by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }

    LaunchedEffect(refundState) {
        if (refundState is ReturnsViewModel.RefundState.Success) {
            viewModel.resetState()
            onRefundComplete()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Process Return") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(
                value = receiptNumber,
                onValueChange = { receiptNumber = it },
                label = { Text("Receipt Number") },
                leadingIcon = { Icon(Icons.Default.Receipt, contentDescription = null) },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = refundAmount,
                onValueChange = { refundAmount = it },
                label = { Text("Refund Amount") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                leadingIcon = { Icon(Icons.Default.AccountBalanceWallet, contentDescription = null) },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it },
                label = { Text("Reason for Return") },
                leadingIcon = { Icon(Icons.Default.Comment, contentDescription = null) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3
            )

            if (refundState is ReturnsViewModel.RefundState.Error) {
                Text(
                    (refundState as ReturnsViewModel.RefundState.Error).message,
                    color = MaterialTheme.colorScheme.error
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = {
                    val amount = refundAmount.toDoubleOrNull() ?: 0.0
                    viewModel.processRefund(receiptNumber, amount, reason)
                },
                modifier = Modifier.fillMaxWidth().height(56.dp),
                enabled = refundState !is ReturnsViewModel.RefundState.Processing,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) {
                if (refundState is ReturnsViewModel.RefundState.Processing) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onError)
                } else {
                    Text("Process Refund", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}
