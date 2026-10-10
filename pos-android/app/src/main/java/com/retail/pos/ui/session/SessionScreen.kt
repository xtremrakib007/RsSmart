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

private data class CashDenomination(val label: String, val sen: Long)

private val malaysiaCashDenominations = listOf(
    CashDenomination("RM100 notes", 10_000),
    CashDenomination("RM50 notes", 5_000),
    CashDenomination("RM20 notes", 2_000),
    CashDenomination("RM10 notes", 1_000),
    CashDenomination("RM5 notes", 500),
    CashDenomination("RM1 notes", 100),
    CashDenomination("50 sen coins", 50),
    CashDenomination("20 sen coins", 20),
    CashDenomination("10 sen coins", 10),
    CashDenomination("5 sen coins", 5)
)

private fun formatRinggit(sen: Long): String =
    "RM " + String.format(Locale.US, "%.2f", sen / 100.0)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    onSessionOpen: () -> Unit,
    viewModel: SessionViewModel = hiltViewModel()
) {
    val openSession by viewModel.openSession.collectAsState()
    val action by viewModel.sessionAction.collectAsState()

    val openingCounts = remember { mutableStateMapOf<Long, String>() }
    val closingCounts = remember { mutableStateMapOf<Long, String>() }
    var notes by remember { mutableStateOf("") }
    var closingNotes by remember { mutableStateOf("") }
    var showCloseDialog by remember { mutableStateOf(false) }

    val openingTotalSen = malaysiaCashDenominations.sumOf { denomination ->
        denomination.sen * (openingCounts[denomination.sen]?.toLongOrNull()?.coerceAtLeast(0) ?: 0L)
    }
    val closingTotalSen = malaysiaCashDenominations.sumOf { denomination ->
        denomination.sen * (closingCounts[denomination.sen]?.toLongOrNull()?.coerceAtLeast(0) ?: 0L)
    }

    LaunchedEffect(action) {
        when (action) {
            is SessionViewModel.SessionAction.Opened -> {
                viewModel.resetAction()
                onSessionOpen()
            }
            is SessionViewModel.SessionAction.Closed -> {
                viewModel.resetAction()
                showCloseDialog = false
                closingCounts.clear()
                closingNotes = ""
            }
            else -> Unit
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Cashier Shift") }) }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (openSession != null) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Shift is open", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
                            Text("Opened: " + java.text.SimpleDateFormat("HH:mm, dd MMM yyyy", Locale.getDefault()).format(java.util.Date(openSession!!.openedAt)))
                            Text("Opening float: " + formatRinggit((openSession!!.openingCash * 100).toLong()), style = MaterialTheme.typography.titleMedium)
                            Text("Sales recorded: " + formatRinggit((openSession!!.totalSales * 100).toLong()))
                            Text("Transactions: ${openSession!!.transactionCount}")
                            Spacer(Modifier.height(4.dp))
                            Button(
                                onClick = { showCloseDialog = true },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                            ) { Text("Count cash and close shift") }
                        }
                    }
                }
            } else {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Open cashier shift", style = MaterialTheme.typography.headlineSmall)
                        Text(
                            "Count the actual cash in the drawer. RsSmart totals the Malaysian notes and coins for you.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Opening cash by denomination", style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.height(8.dp))
                            CashDenominationCounter(
                                counts = openingCounts,
                                onCountChange = { denomination, count -> openingCounts[denomination] = count }
                            )
                            HorizontalDivider()
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Opening float", style = MaterialTheme.typography.titleMedium)
                                Text(formatRinggit(openingTotalSen), style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
                item {
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Shift notes (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2
                    )
                }
                item {
                    if (action is SessionViewModel.SessionAction.Error) {
                        Text((action as SessionViewModel.SessionAction.Error).message, color = MaterialTheme.colorScheme.error)
                    }
                    Button(
                        onClick = {
                            val denominationSummary = malaysiaCashDenominations
                                .mapNotNull { d ->
                                    val count = openingCounts[d.sen]?.toLongOrNull() ?: 0L
                                    if (count > 0) "${d.label}: $count" else null
                                }.joinToString(", ")
                            val fullNotes = listOfNotNull(
                                notes.takeIf { it.isNotBlank() },
                                "Opening cash count: $denominationSummary"
                            ).joinToString("\n")
                            viewModel.openSession(openingTotalSen / 100.0, fullNotes)
                        },
                        enabled = action !is SessionViewModel.SessionAction.Processing,
                        modifier = Modifier.fillMaxWidth().height(54.dp)
                    ) {
                        if (action is SessionViewModel.SessionAction.Processing) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Confirm count and open shift")
                        }
                    }
                }
            }
        }
    }

    if (showCloseDialog) {
        AlertDialog(
            onDismissRequest = { showCloseDialog = false },
            title = { Text("Close cashier shift") },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth().heightIn(max = 520.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Count all notes and coins remaining in the drawer.")
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Physical cash")
                        Text(formatRinggit(closingTotalSen), style = MaterialTheme.typography.titleMedium)
                    }
                    CashDenominationCounter(
                        counts = closingCounts,
                        onCountChange = { denomination, count -> closingCounts[denomination] = count }
                    )
                    OutlinedTextField(
                        value = closingNotes,
                        onValueChange = { closingNotes = it },
                        label = { Text("Closing notes (optional)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (action is SessionViewModel.SessionAction.Error) {
                        Text((action as SessionViewModel.SessionAction.Error).message, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val denominationSummary = malaysiaCashDenominations
                            .mapNotNull { d ->
                                val count = closingCounts[d.sen]?.toLongOrNull() ?: 0L
                                if (count > 0) "${d.label}: $count" else null
                            }.joinToString(", ")
                        val fullNotes = listOfNotNull(
                            closingNotes.takeIf { it.isNotBlank() },
                            "Closing cash count: $denominationSummary"
                        ).joinToString("\n")
                        viewModel.closeSession(closingTotalSen / 100.0, fullNotes)
                    },
                    enabled = action !is SessionViewModel.SessionAction.Processing
                ) { Text("Close shift") }
            },
            dismissButton = {
                TextButton(onClick = { showCloseDialog = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun CashDenominationCounter(
    counts: Map<Long, String>,
    onCountChange: (denominationSen: Long, count: String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        malaysiaCashDenominations.forEach { denomination ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(denomination.label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(
                    value = counts[denomination.sen] ?: "",
                    onValueChange = { raw ->
                        if (raw.isEmpty() || (raw.all(Char::isDigit) && raw.length <= 5)) {
                            onCountChange(denomination.sen, raw)
                        }
                    },
                    modifier = Modifier.width(92.dp),
                    label = { Text("Qty") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
                Text(
                    formatRinggit(denomination.sen * (counts[denomination.sen]?.toLongOrNull()?.coerceAtLeast(0) ?: 0L)),
                    modifier = Modifier.width(82.dp),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
