package com.retail.pos.ui.session

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.viewmodel.SessionViewModel
import java.util.Locale

private data class CashDenomination(val label: String, val value: Double)

private val MYR_DENOMINATIONS = listOf(
    CashDenomination("RM 100 note", 100.0),
    CashDenomination("RM 50 note", 50.0),
    CashDenomination("RM 20 note", 20.0),
    CashDenomination("RM 10 note", 10.0),
    CashDenomination("RM 5 note", 5.0),
    CashDenomination("RM 1 note", 1.0),
    CashDenomination("50 sen coin", 0.50),
    CashDenomination("20 sen coin", 0.20),
    CashDenomination("10 sen coin", 0.10),
    CashDenomination("5 sen coin", 0.05)
)

private fun money(value: Double): String = "RM " + String.format(Locale.US, "%.2f", value)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    onSessionOpen: () -> Unit,
    viewModel: SessionViewModel = hiltViewModel()
) {
    val openSession by viewModel.openSession.collectAsState()
    val action by viewModel.sessionAction.collectAsState()
    var closingCash by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var showCloseDialog by remember { mutableStateOf(false) }
    var denominationCounts by remember { mutableStateOf(List(MYR_DENOMINATIONS.size) { "" }) }

    val openingCash = MYR_DENOMINATIONS.indices.sumOf { index ->
        (denominationCounts[index].toIntOrNull()?.coerceAtLeast(0) ?: 0) * MYR_DENOMINATIONS[index].value
    }
    val invalidCounts = denominationCounts.any { it.isNotBlank() && (it.toIntOrNull() == null || it.toInt() < 0) }

    LaunchedEffect(action) {
        when (action) {
            is SessionViewModel.SessionAction.Opened -> {
                viewModel.resetAction()
                onSessionOpen()
            }
            is SessionViewModel.SessionAction.Closed -> {
                viewModel.resetAction()
                showCloseDialog = false
            }
            else -> {}
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text("RsSmart POS · Cashier Session") }) }) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (action is SessionViewModel.SessionAction.Error) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Text(
                        (action as SessionViewModel.SessionAction.Error).message,
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }

            if (openSession != null) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.Start) {
                        Text("Register is open", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(8.dp))
                        Text("Opened: ${java.text.SimpleDateFormat("HH:mm, dd MMM").format(java.util.Date(openSession!!.openedAt))}")
                        Text("Opening float: ${money(openSession!!.openingCash)}")
                        Text("Sales: ${money(openSession!!.totalSales)}")
                        Text("Transactions: ${openSession!!.transactionCount}")
                        Spacer(Modifier.height(20.dp))
                        Button(
                            onClick = { showCloseDialog = true },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                        ) { Text("Close Register / End Shift") }
                    }
                }
            } else {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Open register", style = MaterialTheme.typography.headlineSmall)
                        Text("Count the cash in the drawer. The opening float is calculated automatically.", style = MaterialTheme.typography.bodyMedium)
                        Spacer(Modifier.height(16.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Denomination", style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
                            Text("Pieces", style = MaterialTheme.typography.labelLarge, modifier = Modifier.width(84.dp))
                            Text("Total", style = MaterialTheme.typography.labelLarge, modifier = Modifier.width(90.dp))
                        }
                        Divider(Modifier.padding(vertical = 6.dp))
                        MYR_DENOMINATIONS.forEachIndexed { index, denomination ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(denomination.label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                                OutlinedTextField(
                                    value = denominationCounts[index],
                                    onValueChange = { next ->
                                        denominationCounts = denominationCounts.toMutableList().also { it[index] = next.filter(Char::isDigit).take(5) }
                                    },
                                    modifier = Modifier.width(84.dp),
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    placeholder = { Text("0") }
                                )
                                Text(
                                    money((denominationCounts[index].toIntOrNull() ?: 0) * denomination.value),
                                    modifier = Modifier.width(90.dp).padding(start = 8.dp),
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                        Divider(Modifier.padding(vertical = 10.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Opening cash total", style = MaterialTheme.typography.titleMedium)
                            Text(money(openingCash), style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                        }
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("Shift notes (optional)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = { viewModel.openSession(openingCash, notes) },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = action !is SessionViewModel.SessionAction.Processing && !invalidCounts
                        ) {
                            if (action is SessionViewModel.SessionAction.Processing) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Counted ${money(openingCash)} · Open Register")
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCloseDialog) {
        AlertDialog(
            onDismissRequest = { showCloseDialog = false },
            title = { Text("Close Register") },
            text = {
                Column {
                    Text("Count all cash in the drawer, then enter the final total.")
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = closingCash,
                        onValueChange = { closingCash = it },
                        label = { Text("Closing cash total (RM)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Shift notes") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { closingCash.toDoubleOrNull()?.let { viewModel.closeSession(it, notes) } },
                    enabled = closingCash.toDoubleOrNull() != null && closingCash.toDoubleOrNull()!! >= 0
                ) { Text("Confirm close") }
            },
            dismissButton = { TextButton(onClick = { showCloseDialog = false }) { Text("Cancel") } }
        )
    }
}
