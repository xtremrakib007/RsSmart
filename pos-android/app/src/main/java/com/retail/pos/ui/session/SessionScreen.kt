package com.retail.pos.ui.session

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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

private val MYR_DENOMINATIONS = listOf(100.0, 50.0, 20.0, 10.0, 5.0, 1.0, 0.50, 0.20, 0.10, 0.05)

private fun myr(value: Double): String = "RM " + String.format(Locale.US, "%.2f", value)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    onSessionOpen: () -> Unit,
    viewModel: SessionViewModel = hiltViewModel()
) {
    val openSession by viewModel.openSession.collectAsState()
    val action by viewModel.sessionAction.collectAsState()
    var manualOpeningCash by remember { mutableStateOf("") }
    var closingCash by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var showCloseDialog by remember { mutableStateOf(false) }
    val denominationCounts = remember { mutableStateMapOf<Double, String>() }
    val hasDenominationCounts = denominationCounts.values.any { (it.toIntOrNull() ?: 0) > 0 }
    val denominationTotal = MYR_DENOMINATIONS.sumOf { denomination ->
        denomination * (denominationCounts[denomination]?.toIntOrNull()?.coerceAtLeast(0) ?: 0)
    }
    val openingCash = if (hasDenominationCounts) denominationTotal else manualOpeningCash.toDoubleOrNull() ?: 0.0

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

    Scaffold(topBar = { TopAppBar(title = { Text("Cash Register") }) }) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (openSession != null) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Register is open", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
                        Text("Opened: ${java.text.SimpleDateFormat("HH:mm, dd MMM", Locale.getDefault()).format(java.util.Date(openSession!!.openedAt))}")
                        Text("Opening float: ${myr(openSession!!.openingCash)}")
                        Text("Cash sales: ${myr(openSession!!.totalSales)}")
                        Text("Transactions: ${openSession!!.transactionCount}")
                        Button(onClick = { showCloseDialog = true }, modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) {
                            Text("Close Register / End Shift")
                        }
                    }
                }
            } else {
                Text("Open register", style = MaterialTheme.typography.headlineMedium)
                Text("Count the cash float before starting your shift. Values are in Malaysian ringgit (MYR).",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Cash denomination count", style = MaterialTheme.typography.titleMedium)
                        Text("Enter how many notes or coins you have for each denomination.")
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(2),
                            modifier = Modifier.fillMaxWidth().height(300.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            userScrollEnabled = true
                        ) {
                            items(MYR_DENOMINATIONS) { denomination ->
                                OutlinedTextField(
                                    value = denominationCounts[denomination] ?: "",
                                    onValueChange = { value ->
                                        denominationCounts[denomination] = value.filter(Char::isDigit).take(4)
                                    },
                                    label = { Text("RM ${String.format(Locale.US, "%.2f", denomination)} count") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Counted total", style = MaterialTheme.typography.titleMedium)
                            Text(myr(denominationTotal), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                        }
                        TextButton(onClick = { denominationCounts.clear() }, modifier = Modifier.align(Alignment.End)) {
                            Text("Clear counts")
                        }
                    }
                }
                OutlinedTextField(
                    value = manualOpeningCash,
                    onValueChange = { manualOpeningCash = it.filter { ch -> ch.isDigit() || ch == '.' }.take(12) },
                    label = { Text(if (hasDenominationCounts) "Manual opening cash (ignored while counts are entered)" else "Opening cash amount (RM)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    enabled = !hasDenominationCounts
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Shift notes (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                    Row(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Opening float total", style = MaterialTheme.typography.titleMedium)
                        Text(myr(openingCash), style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                    }
                }
                if (action is SessionViewModel.SessionAction.Error) {
                    Text((action as SessionViewModel.SessionAction.Error).message, color = MaterialTheme.colorScheme.error)
                }
                Button(
                    onClick = {
                        val breakdown = MYR_DENOMINATIONS.mapNotNull { denomination ->
                            val count = denominationCounts[denomination]?.toIntOrNull() ?: 0
                            if (count > 0) "RM ${String.format(Locale.US, "%.2f", denomination)} x$count" else null
                        }.joinToString(", ")
                        val sessionNotes = listOfNotNull(notes.takeIf { it.isNotBlank() }, breakdown.takeIf { it.isNotBlank() }?.let { "Opening cash count: $it" }).joinToString(" | ")
                        viewModel.openSession(openingCash, sessionNotes.ifBlank { null })
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    enabled = action !is SessionViewModel.SessionAction.Processing && openingCash >= 0.0
                ) {
                    if (action is SessionViewModel.SessionAction.Processing) CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                    else Text("Open Register")
                }
            }
        }
    }

    if (showCloseDialog) {
        AlertDialog(
            onDismissRequest = { showCloseDialog = false },
            title = { Text("Close register") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Count all cash in the drawer before closing.")
                    OutlinedTextField(
                        value = closingCash,
                        onValueChange = { closingCash = it.filter { ch -> ch.isDigit() || ch == '.' }.take(12) },
                        label = { Text("Actual closing cash (RM)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Shift notes") }, modifier = Modifier.fillMaxWidth())
                    Text("Expected cash: ${myr((openSession?.openingCash ?: 0.0) + (openSession?.totalSales ?: 0.0) - (openSession?.totalRefunds ?: 0.0))}")
                    if (action is SessionViewModel.SessionAction.Error) {
                        Text((action as SessionViewModel.SessionAction.Error).message, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                Button(
                    enabled = action !is SessionViewModel.SessionAction.Processing && (closingCash.toDoubleOrNull() ?: -1.0) >= 0.0,
                    onClick = { viewModel.closeSession(closingCash.toDoubleOrNull() ?: 0.0, notes) }
                ) { Text("Close shift") }
            },
            dismissButton = { TextButton(onClick = { showCloseDialog = false }) { Text("Cancel") } }
        )
    }
}
