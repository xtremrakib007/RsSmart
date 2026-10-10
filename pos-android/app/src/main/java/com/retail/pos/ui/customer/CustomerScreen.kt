package com.retail.pos.ui.customer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.retail.pos.viewmodel.CustomerViewModel
import com.retail.shared.data.local.entity.CustomerEntity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerScreen(
    onBack: () -> Unit,
    viewModel: CustomerViewModel = hiltViewModel()
) {
    val customers by viewModel.customers.collectAsState()
    val message by viewModel.message.collectAsState()
    var query by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf<CustomerEntity?>(null) }
    var showEditor by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<CustomerEntity?>(null) }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var loyalty by remember { mutableStateOf("") }

    fun startEditor(customer: CustomerEntity?) {
        editing = customer
        name = customer?.name.orEmpty()
        phone = customer?.phone.orEmpty()
        email = customer?.email.orEmpty()
        loyalty = customer?.loyaltyNumber.orEmpty()
        showEditor = true
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Customers") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back") }
                },
                actions = {
                    IconButton(onClick = { startEditor(null) }) {
                        Icon(Icons.Default.Add, contentDescription = "Add customer")
                    }
                }
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it; viewModel.search(it) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Search name, Malaysian phone, email or member no.") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
            )
            Spacer(Modifier.height(8.dp))
            Text("Customer records are stored on this device only. Server sync is not enabled yet, so records will not appear on other devices.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (!message.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(message!!, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            }
            Spacer(Modifier.height(8.dp))
            if (customers.isEmpty()) {
                Text("No customers yet. Tap + to add a customer.", style = MaterialTheme.typography.bodyMedium)
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(customers, key = { it.id }) { customer ->
                        Card(Modifier.fillMaxWidth(), elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)) {
                            Column(Modifier.padding(14.dp)) {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Column(Modifier.weight(1f)) {
                                        Text(customer.name, style = MaterialTheme.typography.titleMedium)
                                        Text(customer.phone, style = MaterialTheme.typography.bodyMedium)
                                        customer.email?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                                        customer.loyaltyNumber?.let { Text("Member: $it", style = MaterialTheme.typography.bodySmall) }
                                    }
                                    IconButton(onClick = { startEditor(customer) }) {
                                        Icon(Icons.Default.Edit, contentDescription = "Edit customer")
                                    }
                                    IconButton(onClick = { pendingDelete = customer }) {
                                        Icon(Icons.Default.Delete, contentDescription = "Delete customer")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showEditor) {
        AlertDialog(
            onDismissRequest = { showEditor = false },
            title = { Text(if (editing == null) "Add Customer" else "Edit Customer") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(name, { name = it }, label = { Text("Full name *") }, singleLine = true)
                    OutlinedTextField(phone, { phone = it }, label = { Text("Malaysian mobile *") }, placeholder = { Text("0123456789 or +60123456789") }, singleLine = true)
                    OutlinedTextField(email, { email = it }, label = { Text("Email (optional)") }, singleLine = true)
                    OutlinedTextField(loyalty, { loyalty = it }, label = { Text("Member number (optional)") }, singleLine = true)
                }
            },
            confirmButton = {
                Button(onClick = {
                    viewModel.save(editing?.id, name, phone, email, loyalty)
                    showEditor = false
                }, enabled = name.isNotBlank() && phone.isNotBlank()) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { showEditor = false }) { Text("Cancel") } }
        )
    }

    pendingDelete?.let { customer ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Remove customer?") },
            text = { Text("Remove ${customer.name} from this device? This does not delete server records.") },
            confirmButton = {
                Button(onClick = {
                    viewModel.delete(customer)
                    pendingDelete = null
                }) { Text("Remove") }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("Cancel") } }
        )
    }
}
