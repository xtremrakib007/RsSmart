package com.company.salesapp.presentation.expenses

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.presentation.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseScreen(navController: NavController, viewModel: ExpenseViewModel = hiltViewModel()) {
    var amount by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    Scaffold(topBar = { SalesTopBar(title = "Record Expense", onBack = { navController.popBackStack() }) }) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Amount *") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category (Fuel, Food, etc.)") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth().height(100.dp))
            OutlinedButton(onClick = { }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.CameraAlt, null); Spacer(modifier = Modifier.width(8.dp)); Text("Capture Receipt") }
            Button(onClick = { }, modifier = Modifier.fillMaxWidth()) { Text("Save Expense") }
        }
    }
}
class ExpenseViewModel : androidx.lifecycle.ViewModel() {}
