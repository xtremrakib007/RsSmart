package com.company.salesapp.presentation.navigation

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object Customers : Screen("customers")
    object CustomerDetail : Screen("customer_detail/{customerId}") {
        fun createRoute(customerId: String) = "customer_detail/$customerId"
    }
    object CustomerForm : Screen("customer_form?customerId={customerId}") {
        fun createRoute(customerId: String? = null) = 
            if (customerId != null) "customer_form?customerId=$customerId" else "customer_form"
    }
    object Orders : Screen("orders")
    object OrderDetail : Screen("order_detail/{orderId}") {
        fun createRoute(orderId: String) = "order_detail/$orderId"
    }
    object OrderCreate : Screen("order_create/{customerId}") {
        fun createRoute(customerId: String) = "order_create/$customerId"
    }
    object Visits : Screen("visits")
    object VisitRecord : Screen("visit_record/{customerId}") {
        fun createRoute(customerId: String) = "visit_record/$customerId"
    }
    object Collections : Screen("collections")
    object Expenses : Screen("expenses")
    object SyncStatus : Screen("sync_status")
}
