package com.company.salesapp.presentation.customers

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.presentation.components.SalesTopBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerFormScreen(navController: NavController, customerId: String?, viewModel: CustomerFormViewModel = hiltViewModel()) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    val isSaving by viewModel.isSaving.collectAsState()
    val saved by viewModel.saved.collectAsState()

    LaunchedEffect(saved) {
        if (saved) navController.popBackStack()
    }

    LaunchedEffect(customerId) {
        customerId?.let { viewModel.loadCustomer(it) }
    }

    val customer by viewModel.customer.collectAsState()
    customer?.let {
        name = it.name
        email = it.email ?: ""
        phone = it.phone ?: ""
        address = it.address ?: ""
        city = it.city ?: ""
        state = it.state ?: ""
        category = it.category ?: ""
    }

    Scaffold(
        topBar = {
            SalesTopBar(
                title = if (customerId == null) "New Customer" else "Edit Customer",
                onBack = { navController.popBackStack() }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name *") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text("Address") }, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(value = city, onValueChange = { city = it }, label = { Text("City") }, modifier = Modifier.weight(1f))
                OutlinedTextField(value = state, onValueChange = { state = it }, label = { Text("State") }, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category (VIP, Regular, etc.)") }, modifier = Modifier.fillMaxWidth())

            Button(
                onClick = { viewModel.save(name, email, phone, address, city, state, category) },
                modifier = Modifier.fillMaxWidth(),
                enabled = name.isNotBlank() && !isSaving
            ) {
                if (isSaving) CircularProgressIndicator(modifier = Modifier.size(20.dp)) else Text("Save")
            }
        }
    }
}
