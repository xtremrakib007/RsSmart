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

private val MYR_DENOMINATIONS = listOf(
    100.0 to "RM100 note",
    50.0 to "RM50 note",
    20.0 to "RM20 note",
    10.0 to "RM10 note",
    5.0 to "RM5 note",
    1.0 to "RM1 note",
    0.50 to "50 sen coin",
    0.20 to "20 sen coin",
    0.10 to "10 sen coin",
    0.05 to "5 sen coin"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SessionScreen(
    onSessionOpen: () -> Unit,
    viewModel: SessionViewModel = hiltViewModel()
) {
    val openSession by viewModel.openSession.collectAsState()
    val action by viewModel.sessionAction.collectAsState()
    val denominationCounts = remember { mutableStateMapOf<Double, String>() }
    var closingCash by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var showCloseDialog by remember { mutableStateOf(false) }

    val openingCash = MYR_DENOMINATIONS.sumOf { (value, _) ->
        value * (denominationCounts[value]?.toIntOrNull()?.coerceAtLeast(0) ?: 0)
    }
    val invalidCounts = denominationCounts.values.any { it.isNotBlank() && (it.toIntOrNull() == null || it.toIntOrNull()!! < 0) }

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
            else -> {}
        }
    }

    Scaffold(topBar = { TopAppBar(title = { Text("RsSmart POS · Cash Session") }) }) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (openSession != null) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Register is open", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
                        Text("Opened: ${SimpleDateFormat("HH:mm, dd MMM yyyy", Locale.getDefault()).format(Date(openSession!!.openedAt))}")
                        Text("Opening float: RM ${"%.2f".format(Locale.US, openSession!!.openingCash)}")
                        Text("Net sales: RM ${"%.2f".format(Locale.US, openSession!!.totalSales - openSession!!.totalRefunds)}")
                        Text("Transactions: ${openSession!!.transactionCount}")
                        Button(onClick = { showCloseDialog = true }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) {
                            Text("Close register / End shift")
                        }
                    }
                }
            } else {
                Text("Opening float", style = MaterialTheme.typography.headlineMedium)
                Text("Count the cash in your drawer before taking the first sale. Enter the number of each note or coin; the total is calculated automatically.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        MYR_DENOMINATIONS.forEach { (value, label) ->
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Column(Modifier.weight(1f)) {
                                    Text(label, style = MaterialTheme.typography.bodyLarge)
                                    Text("RM ${"%.2f".format(Locale.US, value)} each", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                OutlinedTextField(
                                    value = denominationCounts[value].orEmpty(),
                                    onValueChange = { input ->
                                        if (input.isEmpty() || input.all(Char::isDigit)) denominationCounts[value] = input
                                    },
                                    label = { Text("Qty") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.width(100.dp)
                                )
                                Text("RM ${"%.2f".format(Locale.US, value * (denominationCounts[value]?.toIntOrNull() ?: 0))}", modifier = Modifier.width(76.dp), style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        HorizontalDivider()
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Opening cash total", style = MaterialTheme.typography.titleMedium)
                            Text("RM ${"%.2f".format(Locale.US, openingCash)}", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                }
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Shift notes (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
                if (action is SessionViewModel.SessionAction.Error) {
                    Text((action as SessionViewModel.SessionAction.Error).message, color = MaterialTheme.colorScheme.error)
                }
                Button(
                    onClick = {
                        val breakdown = MYR_DENOMINATIONS.mapNotNull { (value, label) ->
                            val count = denominationCounts[value]?.toIntOrNull() ?: 0
                            if (count > 0) "$label x$count" else null
                        }.joinToString(", ")
                        val savedNotes = listOfNotNull(notes.trim().takeIf { it.isNotEmpty() }, "Opening denomination count: ${breakdown.ifEmpty { "all zero" }}").joinToString("\n")
                        viewModel.openSession(openingCash, savedNotes)
                    },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    enabled = !invalidCounts && action !is SessionViewModel.SessionAction.Processing
                ) {
                    if (action is SessionViewModel.SessionAction.Processing) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    else Text("Confirm count & open register")
                }
            }
            if (action is SessionViewModel.SessionAction.Error && openSession == null) {
                Text((action as SessionViewModel.SessionAction.Error).message, color = MaterialTheme.colorScheme.error)
            }
        }
    }

    if (showCloseDialog) {
        AlertDialog(
            onDismissRequest = { showCloseDialog = false },
            title = { Text("End shift and reconcile cash") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Count all cash in the drawer, including the opening float.")
                    OutlinedTextField(
                        value = closingCash,
                        onValueChange = { closingCash = it },
                        label = { Text("Closing cash total (RM)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text("Expected cash: RM ${"%.2f".format(Locale.US, (openSession?.openingCash ?: 0.0) + (openSession?.totalSales ?: 0.0) - (openSession?.totalRefunds ?: 0.0))}", style = MaterialTheme.typography.bodyMedium)
                    OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Shift notes") }, modifier = Modifier.fillMaxWidth())
                    if (action is SessionViewModel.SessionAction.Error) Text((action as SessionViewModel.SessionAction.Error).message, color = MaterialTheme.colorScheme.error)
                }
            },
            confirmButton = {
                Button(
                    onClick = { closingCash.toDoubleOrNull()?.takeIf { it >= 0 }?.let { viewModel.closeSession(it, notes) } },
                    enabled = closingCash.toDoubleOrNull()?.let { it >= 0 } == true && action !is SessionViewModel.SessionAction.Processing
                ) { Text("Confirm close") }
            },
            dismissButton = { TextButton(onClick = { showCloseDialog = false }) { Text("Cancel") } }
        )
    }
}
