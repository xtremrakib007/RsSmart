package com.retail.pos.ui.payment

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.service.printer.PrintService
import com.retail.shared.data.local.entity.PosOrder
import kotlinx.coroutines.launch
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrinterSettingsScreen(
    onBack: () -> Unit,
    printService: PrintService = hiltViewModel<PrinterSettingsViewModel>().printService
) {
    val printState by printService.printState.collectAsState()
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Receipt Printer") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text("USB / Bluetooth ESC-POS", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(8.dp))
            Text(
                "Connect and pair your 58 mm or 80 mm receipt printer first. The current printer service tries the first connected USB printer, then the first paired Bluetooth printer.",
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(20.dp))
            when (val state = printState) {
                is PrintService.PrintState.Printing -> CircularProgressIndicator()
                is PrintService.PrintState.Success -> Text("Test receipt sent to printer.", color = MaterialTheme.colorScheme.primary)
                is PrintService.PrintState.Error -> Text(state.message, color = MaterialTheme.colorScheme.error)
                else -> Text("Ready to test")
            }
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = {
                    val now = System.currentTimeMillis()
                    val testOrder = PosOrder(
                        id = UUID.randomUUID().toString(),
                        sessionId = "printer-test",
                        receiptNumber = "PRINTER-TEST",
                        subtotal = 0.0,
                        grandTotal = 0.0,
                        itemCount = 0,
                        createdAt = now,
                        syncStatus = "SYNCED"
                    )
                    scope.launch { printService.printReceipt(testOrder) }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = printState !is PrintService.PrintState.Printing
            ) {
                Text("Print Test Receipt")
            }
        }
    }
}
