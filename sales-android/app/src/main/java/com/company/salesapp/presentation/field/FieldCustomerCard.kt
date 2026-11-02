package com.company.salesapp.presentation.field

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.company.salesapp.data.remote.dto.FieldCustomerDto
import com.company.salesapp.presentation.navigation.Screen
import com.company.salesapp.presentation.theme.SuccessGreen

/** A customer in the field: name, area, distance or visit, and the quick actions. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FieldCustomerCard(c: FieldCustomerDto, navController: NavController, showDistance: Boolean) {
    val context = LocalContext.current
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(c.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    val sub = listOfNotNull(c.routeName, c.address ?: c.city).joinToString(" · ")
                    if (sub.isNotBlank()) Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                when {
                    c.visitedAt != null -> AssistChip(onClick = {}, label = { Text("Visited ${timeOf(c.visitedAt)}") },
                        leadingIcon = { Icon(Icons.Default.CheckCircle, null, tint = SuccessGreen) })
                    showDistance -> AssistChip(onClick = {}, label = { Text(formatKm(c.distanceKm)) },
                        leadingIcon = { Icon(Icons.Default.NearMe, null) })
                }
            }
            if ((c.balance ?: 0.0) > 0.0) {
                Text("Due RM %.2f".format(c.balance), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                Action("Visit", Icons.Default.LocationOn, Modifier.weight(1f)) { navController.navigate(Screen.VisitRecord.createRoute(c.id)) }
                Action("Order", Icons.Default.ShoppingCart, Modifier.weight(1f)) { navController.navigate(Screen.OrderCreate.createRoute(c.id)) }
                Action("Call", Icons.Default.Call, Modifier.weight(1f)) { FieldActions.call(context, c.phone) }
                Action("Chat", Icons.Default.Chat, Modifier.weight(1f)) { FieldActions.whatsApp(context, c.phone) }
                Action("Go", Icons.Default.Directions, Modifier.weight(1f)) { FieldActions.directions(context, c.latitude, c.longitude, c.address) }
            }
        }
    }
}

@Composable
private fun Action(label: String, icon: ImageVector, modifier: Modifier, onClick: () -> Unit) {
    FilledTonalButton(onClick = onClick, modifier = modifier, contentPadding = PaddingValues(horizontal = 2.dp, vertical = 6.dp)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, contentDescription = label, modifier = Modifier.size(18.dp))
            Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1)
        }
    }
}
