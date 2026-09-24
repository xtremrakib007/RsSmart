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

@Composable
fun SessionScreen(
    onSessionOpen: () -> Unit,
    viewModel: SessionViewModel = hiltViewModel()
) {
    val openSession by viewModel.openSession.collectAsState()
    val action by viewModel.sessionAction.collectAsState()

    var openingCash by remember { mutableStateOf("") }
    var closingCash by remember { mutableStateOf("") }
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
                        OutlinedTextField(
                            value = openingCash,
                            onValueChange = { openingCash = it },
                            label = { Text("Opening Cash") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth()
                        )
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
                                val cash = openingCash.toDoubleOrNull() ?: 0.0
                                viewModel.openSession(cash, notes)
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
                    OutlinedTextField(
                        value = closingCash,
                        onValueChange = { closingCash = it },
                        label = { Text("Closing Cash") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth()
                    )
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
                    val cash = closingCash.toDoubleOrNull() ?: 0.0
                    viewModel.closeSession(cash, notes)
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
