package com.company.salesapp.presentation.field

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.company.salesapp.presentation.components.EmptyState
import com.company.salesapp.presentation.components.ErrorMessage
import com.company.salesapp.presentation.components.SalesTopBar

/** The salesman's customers nearest first from where he stands. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NearbyScreen(navController: NavController, viewModel: NearbyViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { viewModel.load() }
    LaunchedEffect(Unit) {
        permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }

    Scaffold(topBar = {
        SalesTopBar(title = "Nearby customers", onBack = { navController.popBackStack() }, actions = {
            IconButton(onClick = { viewModel.load() }) { Icon(Icons.Default.MyLocation, "Update location") }
        })
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = state.query, onValueChange = viewModel::setQuery,
                placeholder = { Text("Search name, area, route…") },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            )
            val q = state.query.trim().lowercase()
            val shown = state.customers.filter { c ->
                q.isEmpty() || listOfNotNull(c.name, c.address, c.city, c.routeName, c.phone).any { it.lowercase().contains(q) }
            }
            when {
                state.loading -> Row(Modifier.padding(16.dp)) { CircularProgressIndicator(Modifier.size(20.dp)); Spacer(Modifier.width(10.dp)); Text("Finding your location…") }
                state.error != null -> ErrorMessage(state.error!!) { viewModel.load() }
                state.located && shown.isEmpty() -> EmptyState(if (q.isEmpty()) "No customers yet" else "No customers match \"${state.query}\"")
                else -> LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(shown, key = { it.id }) { c -> FieldCustomerCard(c, navController, showDistance = true) }
                }
            }
        }
    }
}
