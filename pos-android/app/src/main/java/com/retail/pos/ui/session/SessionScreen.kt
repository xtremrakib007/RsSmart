package com.retail.pos.ui.session

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.viewmodel.SessionViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    onSessionOpen: () -> Unit,
    viewModel: SessionViewModel = hiltViewModel()
) {
    val openSession by viewModel.openSession.collectAsState()
    val action by viewModel.sessionAction.collectAsState()

    val denominations = listOf(100.0, 50.0, 20.0, 10.0, 5.0, 1.0, 0.50, 0.20, 0.10, 0.05)
    val openingCounts = remember { mutableStateMapOf<Double, String>() }
    val closingCounts = remember { mutableStateMapOf<Double, String>() }
    val openingCash = denominations.sumOf { denomination -> denomination * (openingCounts[denomination]?.toIntOrNull() ?: 0) }
    val closingCash = denominations.sumOf { denomination -> denomination * (closingCounts[denomination]?.toIntOrNull() ?: 0) }
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
            else -> {}
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("POS Session") })
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            if (openSession != null) {
                // Session is open — show current status and close option
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Session Active", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Opened: ${java.text.SimpleDateFormat("HH:mm, dd MMM").format(java.util.Date(openSession!!.openedAt))}")
                        Text("Opening Cash: $${"%.2f".format(openSession!!.openingCash)}")
                        Text("Sales: $${"%.2f".format(openSession!!.totalSales)}")
                        Text("Transactions: ${openSession!!.transactionCount}")
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(onClick = { showCloseDialog = true }, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) {
                            Text("Close Session")
                        }
                    }
                }
            } else {
                // No session — show open form
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Open Session", style = MaterialTheme.typography.headlineMedium)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Opening cash count (RM)", style = MaterialTheme.typography.titleMedium)
                        Text("Count each denomination. The total is calculated automatically.", style = MaterialTheme.typography.bodySmall)
                        denominations.chunked(2).forEach { pair ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                pair.forEach { denomination ->
                                    OutlinedTextField(
                                        value = openingCounts[denomination] ?: "",
                                        onValueChange = { value -> openingCounts[denomination] = value.filter(Char::isDigit).take(5) },
                                        label = { Text("RM ${"%.2f".format(denomination)} ×") },
                                        suffix = { Text("RM ${"%.2f".format(denomination * (openingCounts[denomination]?.toIntOrNull() ?: 0))}") },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        modifier = Modifier.weight(1f),
                                        singleLine = true
                                    )
                                }
                                if (pair.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                        Text("Opening total: RM ${"%.2f".format(openingCash)}", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("Notes (optional)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = {
                                viewModel.openSession(openingCash, notes)
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = action !is SessionViewModel.SessionAction.Processing
                        ) {
                            if (action is SessionViewModel.SessionAction.Processing) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Open Session")
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
            title = { Text("Close Session") },
            text = {
                Column {
                    Text("Count closing cash (RM)", style = MaterialTheme.typography.titleMedium)
                    denominations.chunked(2).forEach { pair ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            pair.forEach { denomination ->
                                OutlinedTextField(
                                    value = closingCounts[denomination] ?: "",
                                    onValueChange = { value -> closingCounts[denomination] = value.filter(Char::isDigit).take(5) },
                                    label = { Text("RM ${"%.2f".format(denomination)} ×") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.weight(1f),
                                    singleLine = true
                                )
                            }
                            if (pair.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                    Text("Closing total: RM ${"%.2f".format(closingCash)}", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Notes") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(onClick = {
                    viewModel.closeSession(closingCash, notes)
                }) {
                    Text("Close")
                }
            },
            dismissButton = {
                TextButton(onClick = { showCloseDialog = false }) { Text("Cancel") }
            }
        )
    }
}
