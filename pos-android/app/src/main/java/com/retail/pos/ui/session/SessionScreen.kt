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
import java.text.NumberFormat
import java.util.Locale

private val MYR = NumberFormat.getCurrencyInstance(Locale("ms", "MY"))
private val DENOMINATIONS = listOf(100.0, 50.0, 20.0, 10.0, 5.0, 1.0, 0.50, 0.20, 0.10, 0.05)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    onSessionOpen: () -> Unit,
    viewModel: SessionViewModel = hiltViewModel()
) {
    val openSession by viewModel.openSession.collectAsState()
    val action by viewModel.sessionAction.collectAsState()
    var denominationCounts by remember { mutableStateOf(DENOMINATIONS.associateWith { "" }) }
    var openingCash by remember { mutableStateOf("") }
    var closingCash by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var showCloseDialog by remember { mutableStateOf(false) }

    val denominationTotal = DENOMINATIONS.sumOf { denomination ->
        denomination * (denominationCounts[denomination]?.toIntOrNull() ?: 0)
    }
    val isDenominationMode = denominationCounts.values.any { it.isNotBlank() }

    LaunchedEffect(action) {
        when (action) {
            is SessionViewModel.SessionAction.Opened -> {
                viewModel.resetAction()
                onSessionOpen()
            }
            is SessionViewModel.SessionAction.Closed -> {
                viewModel.resetAction()
                showCloseDialog = false
                closingCash = ""
            }
            else -> Unit
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text("Cashier Shift") }) }) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (openSession != null) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Shift Active", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(8.dp))
                        Text("Opened: ${java.text.SimpleDateFormat("HH:mm, dd MMM", Locale.getDefault()).format(java.util.Date(openSession!!.openedAt))}")
                        Text("Opening float: ${MYR.format(openSession!!.openingCash)}")
                        Text("Sales: ${MYR.format(openSession!!.totalSales)}")
                        Text("Transactions: ${openSession!!.transactionCount}")
                        Spacer(Modifier.height(20.dp))
                        Button(
                            onClick = { showCloseDialog = true },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                        ) { Text("Close Shift & Count Cash") }
                    }
                }
            } else {
                Text("Open Cashier Shift", style = MaterialTheme.typography.headlineSmall)
                Text("Count the opening cash float before starting sales.", style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.height(12.dp))
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Cash denomination count (RM)", style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(8.dp))
                        DENOMINATIONS.forEach { denomination ->
                            Row(
                                Modifier.fillMaxWidth().padding(vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    if (denomination >= 1.0) "RM ${denomination.toInt()}" else "Sen ${(denomination * 100).toInt()}",
                                    modifier = Modifier.weight(1f),
                                    style = MaterialTheme.typography.bodyLarge
                                )
                                OutlinedTextField(
                                    value = denominationCounts[denomination].orEmpty(),
                                    onValueChange = { value ->
                                        if (value.isEmpty() || (value.toIntOrNull() != null && value.toIntOrNull()!! >= 0)) {
                                            denominationCounts = denominationCounts.toMutableMap().apply { put(denomination, value) }
                                        }
                                    },
                                    modifier = Modifier.width(110.dp),
                                    label = { Text("Pieces") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                                )
                                Text(MYR.format(denomination * (denominationCounts[denomination]?.toIntOrNull() ?: 0)), modifier = Modifier.width(92.dp), style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        HorizontalDivider(Modifier.padding(vertical = 8.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Counted total", style = MaterialTheme.typography.titleMedium)
                            Text(MYR.format(denominationTotal), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                        }
                        TextButton(
                            onClick = { denominationCounts = DENOMINATIONS.associateWith { "" } },
                            modifier = Modifier.align(Alignment.End)
                        ) { Text("Clear counts") }
                    }
                }
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = openingCash,
                    onValueChange = { openingCash = it },
                    label = { Text(if (isDenominationMode) "Opening cash override (optional)" else "Opening cash float (RM)") },
                    supportingText = { Text(if (isDenominationMode) "Leave blank to use the denomination total." else "Enter the total cash float in RM.") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Shift notes (optional)") },
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = {
                        val amount = if (openingCash.isBlank() && isDenominationMode) denominationTotal else openingCash.toDoubleOrNull()
                        if (amount != null && amount >= 0.0) viewModel.openSession(amount, notes)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = action !is SessionViewModel.SessionAction.Processing &&
                        ((openingCash.isBlank() && isDenominationMode) || (openingCash.toDoubleOrNull()?.let { it >= 0.0 } == true))
                ) {
                    if (action is SessionViewModel.SessionAction.Processing) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    else Text("Confirm Opening Float & Start Sales")
                }
            }
            val error = action as? SessionViewModel.SessionAction.Error
            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Text(error.message, color = MaterialTheme.colorScheme.error)
            }
        }
    }

    if (showCloseDialog && openSession != null) {
        AlertDialog(
            onDismissRequest = { showCloseDialog = false },
            title = { Text("Close Shift") },
            text = {
                Column {
                    Text("Expected cash: ${MYR.format(openSession!!.openingCash + openSession!!.totalSales - openSession!!.totalRefunds)}")
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = closingCash,
                        onValueChange = { closingCash = it },
                        label = { Text("Actual cash counted (RM)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Shift notes") }, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = { closingCash.toDoubleOrNull()?.takeIf { it >= 0.0 }?.let { viewModel.closeSession(it, notes) } },
                    enabled = closingCash.toDoubleOrNull()?.let { it >= 0.0 } == true
                ) { Text("Confirm Close") }
            },
            dismissButton = { TextButton(onClick = { showCloseDialog = false }) { Text("Cancel") } }
        )
    }
}
