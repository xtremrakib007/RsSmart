package com.company.salesapp.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.company.salesapp.presentation.auth.LoginScreen
import com.company.salesapp.presentation.dashboard.DashboardScreen
import com.company.salesapp.presentation.customers.CustomerListScreen
import com.company.salesapp.presentation.customers.CustomerDetailScreen
import com.company.salesapp.presentation.customers.CustomerFormScreen
import com.company.salesapp.presentation.orders.OrderListScreen
import com.company.salesapp.presentation.orders.OrderCreateScreen
import com.company.salesapp.presentation.visits.VisitListScreen
import com.company.salesapp.presentation.visits.VisitRecordScreen
import com.company.salesapp.presentation.collections.CollectionScreen
import com.company.salesapp.presentation.expenses.ExpenseScreen
import com.company.salesapp.presentation.sync.SyncStatusScreen
import com.company.salesapp.presentation.field.AttendanceScreen
import com.company.salesapp.presentation.field.NearbyScreen
import com.company.salesapp.presentation.field.TeamAttendanceScreen
import com.company.salesapp.presentation.field.TodayScreen
import com.company.salesapp.presentation.settings.AppSettingsScreen

@Composable
fun SalesNavGraph(navController: NavHostController) {
    NavHost(navController = navController, startDestination = Screen.Login.route) {
        composable(Screen.Login.route) { LoginScreen(navController) }
        composable(Screen.Dashboard.route) { DashboardScreen(navController) }
        composable(Screen.Customers.route) { CustomerListScreen(navController) }
        composable(Screen.CustomerDetail.route) { backStackEntry ->
            val customerId = backStackEntry.arguments?.getString("customerId") ?: ""
            CustomerDetailScreen(navController, customerId)
        }
        composable(Screen.CustomerForm.route) { backStackEntry ->
            val customerId = backStackEntry.arguments?.getString("customerId")
            CustomerFormScreen(navController, customerId)
        }
        composable(Screen.Orders.route) { OrderListScreen(navController) }
        composable(Screen.OrderCreate.route) { backStackEntry ->
            val customerId = backStackEntry.arguments?.getString("customerId") ?: ""
            OrderCreateScreen(navController, customerId)
        }
        composable(Screen.Visits.route) { VisitListScreen(navController) }
        composable(Screen.VisitRecord.route) { backStackEntry ->
            val customerId = backStackEntry.arguments?.getString("customerId") ?: ""
            VisitRecordScreen(navController, customerId)
        }
        composable(Screen.Collections.route) { CollectionScreen(navController) }
        composable(Screen.Expenses.route) { ExpenseScreen(navController) }
        composable(Screen.SyncStatus.route) { SyncStatusScreen(navController) }
        composable(Screen.Attendance.route) { AttendanceScreen(navController) }
        composable(Screen.Today.route) { TodayScreen(navController) }
        composable(Screen.Nearby.route) { NearbyScreen(navController) }
        composable(Screen.TeamAttendance.route) { TeamAttendanceScreen(navController) }
        composable(Screen.AppSettings.route) { AppSettingsScreen(navController) }
    }
}
