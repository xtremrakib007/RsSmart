package com.retail.pos.ui.session

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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

private val cashDenominations = listOf(100.00, 50.00, 20.00, 10.00, 5.00, 1.00, 0.50, 0.20, 0.10, 0.05)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    onSessionOpen: () -> Unit,
    onLogout: () -> Unit,
    viewModel: SessionViewModel = hiltViewModel()
) {
    val openSession by viewModel.openSession.collectAsState()
    val action by viewModel.sessionAction.collectAsState()
    var openingCounts by remember { mutableStateOf(cashDenominations.associateWith { "" }) }
    var closingCounts by remember { mutableStateOf(cashDenominations.associateWith { "" }) }
    var notes by remember { mutableStateOf("") }
    var closingNotes by remember { mutableStateOf("") }
    var showCloseDialog by remember { mutableStateOf(false) }
    val openingTotal = cashTotal(openingCounts)
    val closingTotal = cashTotal(closingCounts)

    LaunchedEffect(action) {
        when (action) {
            is SessionViewModel.SessionAction.Opened -> { viewModel.resetAction(); onSessionOpen() }
            is SessionViewModel.SessionAction.Closed -> {
                viewModel.resetAction()
                showCloseDialog = false
                closingNotes = ""
                closingCounts = cashDenominations.associateWith { "" }
            }
            else -> {}
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("POS Session") },
                actions = {
                    TextButton(
                        enabled = openSession == null,
                        onClick = { viewModel.logout(onLogout) }
                    ) { Text("Sign out") }
                }
            )
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).padding(16.dp), contentAlignment = Alignment.Center) {
            if (openSession != null) {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Session Active", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(8.dp))
                        Text("Opened: ${java.text.SimpleDateFormat("HH:mm, dd MMM", Locale.getDefault()).format(java.util.Date(openSession!!.openedAt))}")
                        Text("Opening cash: RM ${money(openSession!!.openingCash)}")
                        Text("Sales: RM ${money(openSession!!.totalSales)}")
                        Text("Refunds: RM ${money(openSession!!.totalRefunds)}")
                        Text("Transactions: ${openSession!!.transactionCount}")
                        Spacer(Modifier.height(20.dp))
                        Button(onClick = { showCloseDialog = true }, modifier = Modifier.fillMaxWidth()) { Text("Close shift / cash up") }
                    }
                }
            } else {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Open shift", style = MaterialTheme.typography.headlineMedium)
                        Text("Count the opening float by Malaysian Ringgit denomination.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(12.dp))
                        DenominationCounter(openingCounts, { openingCounts = it }, openingTotal)
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Shift notes (optional)") }, modifier = Modifier.fillMaxWidth())
                        if (action is SessionViewModel.SessionAction.Error) {
                            Spacer(Modifier.height(8.dp))
                            Text((action as SessionViewModel.SessionAction.Error).message, color = MaterialTheme.colorScheme.error)
                        }
                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = { viewModel.openSession(openingTotal, notes.takeIf { it.isNotBlank() }) },
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            enabled = action !is SessionViewModel.SessionAction.Processing
                        ) {
                            if (action is SessionViewModel.SessionAction.Processing) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            else Text("Open Register — RM ${money(openingTotal)}")
                        }
                    }
                }
            }
        }
    }

    if (showCloseDialog) {
        AlertDialog(
            onDismissRequest = { showCloseDialog = false },
            title = { Text("Close shift and count cash") },
            text = {
                Column {
                    Text("Count the drawer cash. The system compares this amount with expected cash.")
                    Spacer(Modifier.height(8.dp))
                    DenominationCounter(closingCounts, { closingCounts = it }, closingTotal)
                    OutlinedTextField(value = closingNotes, onValueChange = { closingNotes = it }, label = { Text("Closing notes (optional)") }, modifier = Modifier.fillMaxWidth())
                    if (action is SessionViewModel.SessionAction.Error) Text((action as SessionViewModel.SessionAction.Error).message, color = MaterialTheme.colorScheme.error)
                }
            },
            confirmButton = {
                Button(onClick = { viewModel.closeSession(closingTotal, closingNotes.takeIf { it.isNotBlank() }) }, enabled = action !is SessionViewModel.SessionAction.Processing) { Text("Confirm cash-up") }
            },
            dismissButton = { TextButton(onClick = { showCloseDialog = false }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun DenominationCounter(counts: Map<Double, String>, onCountsChange: (Map<Double, String>) -> Unit, total: Double) {
    Column {
        Text("Cash denominations (RM)", style = MaterialTheme.typography.titleMedium)
        LazyColumn(Modifier.heightIn(max = 250.dp)) {
            items(cashDenominations) { denomination ->
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("RM ${money(denomination)}", modifier = Modifier.weight(1f))
                    OutlinedTextField(
                        value = counts[denomination] ?: "",
                        onValueChange = { value -> if (value.isEmpty() || value.all(Char::isDigit)) onCountsChange(counts + (denomination to value)) },
                        label = { Text("Count") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.width(96.dp)
                    )
                    Text("RM ${money(denomination * ((counts[denomination]?.toIntOrNull() ?: 0).coerceAtLeast(0)))}", modifier = Modifier.width(78.dp))
                }
            }
        }
        HorizontalDivider()
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Counted total", style = MaterialTheme.typography.titleMedium)
            Text("RM ${money(total)}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
        }
    }
}

private fun cashTotal(counts: Map<Double, String>): Double = cashDenominations.sumOf { denomination ->
    denomination * ((counts[denomination]?.toIntOrNull() ?: 0).coerceAtLeast(0))
}
private fun money(value: Double): String = String.format(Locale.US, "%.2f", value)
