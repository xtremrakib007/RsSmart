package com.retail.pos.ui.customer

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.retail.pos.session.PosSessionProvider
import com.retail.shared.data.local.dao.CustomerDao
import com.retail.shared.data.local.entity.Customer
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class CustomerViewModel @Inject constructor(
    private val customerDao: CustomerDao,
    private val sessionProvider: PosSessionProvider
) : ViewModel() {
    private val query = MutableStateFlow("")
    val searchQuery = query.asStateFlow()
    val customers: StateFlow<List<Customer>> = combine(query, sessionProvider.tenantId) { q, tenant ->
        q to tenant
    }.flatMapLatest { (q, tenant) ->
        if (q.isBlank()) customerDao.getAll(tenant) else customerDao.search(tenant, q)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _message = MutableStateFlow<String?>(null)
    val message = _message.asStateFlow()

    fun search(value: String) { query.value = value }

    fun add(name: String, phone: String, email: String, loyalty: String, notes: String) {
        viewModelScope.launch {
            val cleanName = name.trim()
            val cleanPhone = phone.trim().replace(" ", "").replace("-", "")
            if (cleanName.isBlank()) { _message.value = "Enter the customer's name."; return@launch }
            if (!cleanPhone.matches(Regex("^(\\+?6?01[0-9]{8,9}|\\+?60[0-9]{8,10})$"))) {
                _message.value = "Enter a valid Malaysian phone number, e.g. 0123456789 or +60123456789."
                return@launch
            }
            val tenant = sessionProvider.tenantId.first()
            try {
                val now = System.currentTimeMillis()
                customerDao.insert(Customer(
                    id = UUID.randomUUID().toString(), tenantId = tenant, name = cleanName,
                    phone = cleanPhone, email = email.trim().ifBlank { null },
                    loyaltyNumber = loyalty.trim().ifBlank { null }, notes = notes.trim().ifBlank { null },
                    createdAt = now, updatedAt = now
                ))
                _message.value = "Customer saved on this device. Server sync requires a configured backend."
            } catch (_: Exception) {
                _message.value = "A customer with this phone number may already exist."
            }
        }
    }

    fun clearMessage() { _message.value = null }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerScreen(onBack: () -> Unit, viewModel: CustomerViewModel = hiltViewModel()) {
    val customers by viewModel.customers.collectAsState()
    val query by viewModel.searchQuery.collectAsState()
    val message by viewModel.message.collectAsState()
    var showAdd by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var loyalty by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    Scaffold(topBar = {
        TopAppBar(title = { Text("Customers") }, navigationIcon = {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back") }
        }, actions = {
            IconButton(onClick = { showAdd = true }) { Icon(Icons.Default.PersonAdd, contentDescription = "Add customer") }
        })
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            OutlinedTextField(query, viewModel::search, Modifier.fillMaxWidth(), label = { Text("Search name, phone or loyalty no.") }, singleLine = true)
            Spacer(Modifier.height(12.dp))
            if (customers.isEmpty()) Text("No customers yet. Tap + to add a customer.", style = MaterialTheme.typography.bodyMedium)
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(customers, key = { it.id }) { customer ->
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(14.dp)) {
                            Text(customer.name, style = MaterialTheme.typography.titleMedium)
                            Text(customer.phone, style = MaterialTheme.typography.bodyMedium)
                            customer.email?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                            customer.loyaltyNumber?.let { Text("Loyalty: $it", style = MaterialTheme.typography.bodySmall) }
                        }
                    }
                }
            }
        }
    }

    if (showAdd) {
        AlertDialog(
            onDismissRequest = { showAdd = false },
            title = { Text("Add customer") },
            text = {
                Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(name, { name = it }, label = { Text("Full name *") }, singleLine = true)
                    OutlinedTextField(phone, { phone = it }, label = { Text("Malaysia phone *") }, singleLine = true)
                    OutlinedTextField(email, { email = it }, label = { Text("Email (optional)") }, singleLine = true)
                    OutlinedTextField(loyalty, { loyalty = it }, label = { Text("Loyalty/member number") }, singleLine = true)
                    OutlinedTextField(notes, { notes = it }, label = { Text("Notes (optional)") })
                }
            },
            confirmButton = {
                Button(onClick = {
                    viewModel.add(name, phone, email, loyalty, notes)
                    showAdd = false
                    name = ""; phone = ""; email = ""; loyalty = ""; notes = ""
                }) { Text("Save customer") }
            },
            dismissButton = { TextButton(onClick = { showAdd = false }) { Text("Cancel") } }
        )
    }

    if (message != null) {
        AlertDialog(onDismissRequest = { viewModel.clearMessage() }, title = { Text("Customer") },
            text = { Text(message.orEmpty()) },
            confirmButton = { TextButton(onClick = { viewModel.clearMessage() }) { Text("OK") } })
    }
}
