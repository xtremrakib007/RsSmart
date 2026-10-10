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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private data class CashDenomination(val label: String, val value: Double)

private val MYR_DENOMINATIONS = listOf(
    CashDenomination("RM100 note", 100.00),
    CashDenomination("RM50 note", 50.00),
    CashDenomination("RM20 note", 20.00),
    CashDenomination("RM10 note", 10.00),
    CashDenomination("RM5 note", 5.00),
    CashDenomination("RM1 note", 1.00),
    CashDenomination("50 sen coin", 0.50),
    CashDenomination("20 sen coin", 0.20),
    CashDenomination("10 sen coin", 0.10),
    CashDenomination("5 sen coin", 0.05)
)

private fun newDenominationCounts() = mutableStateMapOf<String, String>().apply {
    MYR_DENOMINATIONS.forEach { this[it.label] = "0" }
}

private fun denominationTotal(counts: Map<String, String>): Double =
    MYR_DENOMINATIONS.sumOf { denomination ->
        denomination.value * (counts[denomination.label]?.toIntOrNull()?.coerceAtLeast(0) ?: 0)
    }

private fun money(value: Double) = "RM " + String.format(Locale.US, "%.2f", value)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    onSessionOpen: () -> Unit,
    viewModel: SessionViewModel = hiltViewModel()
) {
    val openSession by viewModel.openSession.collectAsState()
    val action by viewModel.sessionAction.collectAsState()
    val openingCounts = remember { newDenominationCounts() }
    val closingCounts = remember { newDenominationCounts() }
    var notes by remember { mutableStateOf("") }
    var showCloseDialog by remember { mutableStateOf(false) }

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
            else -> Unit
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text("RsSmart POS • Cashier Shift") }) }) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (openSession != null) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text("Shift is open", style = MaterialTheme.typography.headlineSmall)
                        Text("Opened: ${SimpleDateFormat("HH:mm, dd MMM yyyy", Locale.getDefault()).format(Date(openSession!!.openedAt))}")
                        SummaryLine("Opening float", money(openSession!!.openingCash))
                        SummaryLine("Recorded sales", money(openSession!!.totalSales))
                        SummaryLine("Refunds", money(openSession!!.totalRefunds))
                        SummaryLine("Transactions", openSession!!.transactionCount.toString())
                        Button(
                            onClick = {
                                MYR_DENOMINATIONS.forEach { closingCounts[it.label] = "0" }
                                showCloseDialog = true
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) { Text("Count cash & close shift") }
                    }
                }
            } else {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text("Open cashier shift", style = MaterialTheme.typography.headlineSmall)
                        Text(
                            "Count the actual notes and coins in the till. RsSmart calculates the opening float in Malaysian ringgit.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        DenominationCounter(counts = openingCounts)
                        HorizontalDivider()
                        SummaryLine("Opening cash total", money(denominationTotal(openingCounts)))
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("Shift notes (optional)") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2
                        )
                        val invalidCounts = openingCounts.values.any { (it.toIntOrNull() ?: -1) < 0 || it.toIntOrNull() == null }
                        Button(
                            onClick = {
                                val breakdown = MYR_DENOMINATIONS.joinToString("; ") {
                                    "${it.label} x ${openingCounts[it.label] ?: "0"}"
                                }
                                val auditNotes = listOfNotNull(
                                    "Opening denomination count: $breakdown",
                                    notes.trim().takeIf { it.isNotEmpty() }
                                ).joinToString(" | ")
                                viewModel.openSession(denominationTotal(openingCounts), auditNotes)
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = action !is SessionViewModel.SessionAction.Processing &&
                                !invalidCounts && denominationTotal(openingCounts) >= 0.0
                        ) {
                            if (action is SessionViewModel.SessionAction.Processing) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Confirm count & open shift")
                            }
                        }
                    }
                }
            }

            when (val current = action) {
                is SessionViewModel.SessionAction.Error -> {
                    Text(current.message, color = MaterialTheme.colorScheme.error)
                }
                else -> Unit
            }
        }
    }

    if (showCloseDialog && openSession != null) {
        AlertDialog(
            onDismissRequest = { showCloseDialog = false },
            title = { Text("Close shift & reconcile cash") },
            text = {
                Column(
                    modifier = Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Count every note and coin remaining in the cash drawer.")
                    DenominationCounter(counts = closingCounts)
                    HorizontalDivider()
                    SummaryLine("Actual cash counted", money(denominationTotal(closingCounts)))
                    val expected = openSession!!.openingCash + openSession!!.totalSales - openSession!!.totalRefunds
                    SummaryLine("Expected cash*", money(expected))
                    SummaryLine("Difference", money(denominationTotal(closingCounts) - expected))
                    Text(
                        "*Expected cash excludes card, DuitNow QR and other non-cash payments. Payment-method reconciliation must be completed from the sales ledger.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val breakdown = MYR_DENOMINATIONS.joinToString("; ") {
                            "${it.label} x ${closingCounts[it.label] ?: "0"}"
                        }
                        viewModel.closeSession(
                            denominationTotal(closingCounts),
                            "Closing denomination count: $breakdown"
                        )
                    },
                    enabled = action !is SessionViewModel.SessionAction.Processing &&
                        closingCounts.values.all { (it.toIntOrNull() ?: -1) >= 0 }
                ) { Text("Confirm close") }
            },
            dismissButton = {
                TextButton(onClick = { showCloseDialog = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun DenominationCounter(counts: MutableMap<String, String>) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        MYR_DENOMINATIONS.forEach { denomination ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(denomination.label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(
                    value = counts[denomination.label] ?: "0",
                    onValueChange = { input ->
                        if (input.isEmpty() || input.all(Char::isDigit)) {
                            counts[denomination.label] = input
                        }
                    },
                    modifier = Modifier.width(92.dp),
                    label = { Text("Qty") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
                Text(
                    money(denomination.value * ((counts[denomination.label]?.toIntOrNull() ?: 0).coerceAtLeast(0))),
                    modifier = Modifier.width(88.dp),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun SummaryLine(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label)
        Text(value, style = MaterialTheme.typography.titleMedium)
    }
}
