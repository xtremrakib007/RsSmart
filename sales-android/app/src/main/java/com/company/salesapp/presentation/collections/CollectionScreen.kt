package com.company.salesapp.presentation.collections

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
fun CollectionScreen(navController: NavController, viewModel: CollectionViewModel = hiltViewModel()) {
    var amount by remember { mutableStateOf("") }
    var method by remember { mutableStateOf("CASH") }
    var reference by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    Scaffold(topBar = { SalesTopBar(title = "Record Collection", onBack = { navController.popBackStack() }) }) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Amount *") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = method, onValueChange = { method = it }, label = { Text("Method (CASH/CARD/CHEQUE)") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = reference, onValueChange = { reference = it }, label = { Text("Reference / Cheque No") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth().height(100.dp))
            Button(onClick = { }, modifier = Modifier.fillMaxWidth()) { Text("Save Collection") }
        }
    }
}
class CollectionViewModel : androidx.lifecycle.ViewModel() {}
