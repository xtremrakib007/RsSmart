package com.retail.pos.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.retail.pos.ui.cart.CartScreen
import com.retail.pos.ui.checkout.CheckoutScreen
import com.retail.pos.ui.payment.PaymentScreen
import com.retail.pos.ui.product.ProductCatalogScreen
import com.retail.pos.ui.product.BarcodeScannerScreen
import com.retail.pos.ui.product.PriceCheckScreen
import com.retail.pos.ui.payment.PrinterSettingsScreen
import com.retail.pos.ui.session.SessionScreen
import com.retail.pos.ui.session.PosLoginScreen
import com.retail.pos.ui.customer.CustomerScreen

object PosRoutes {
    const val LOGIN = "login"
    const val SESSION = "session"
    const val CATALOG = "catalog"
    const val SCANNER = "scanner"
    const val PRICE_CHECK = "price-check"
    const val PRINTER = "printer"
    const val CUSTOMERS = "customers"
    const val CART = "cart"
    const val CHECKOUT = "checkout"
    const val PAYMENT = "payment/{orderId}"
    const val PAYMENT_BASE = "payment/"
}

@Composable
fun PosNavHost(navController: NavHostController = rememberNavController()) {
    NavHost(
        navController = navController,
        startDestination = PosRoutes.LOGIN
    ) {
        composable(PosRoutes.LOGIN) {
            PosLoginScreen(
                onLoggedIn = {
                    navController.navigate(PosRoutes.SESSION) {
                        popUpTo(PosRoutes.LOGIN) { inclusive = true }
                        launchSingleTop = true
                    }
                }
            )
        }
        composable(PosRoutes.SESSION) {
            SessionScreen(
                onSessionOpen = { navController.navigate(PosRoutes.CATALOG) },
                onLogout = {
                    navController.navigate(PosRoutes.LOGIN) {
                        popUpTo(PosRoutes.SESSION) { inclusive = true }
                        launchSingleTop = true
                    }
                }
            )
        }
        composable(PosRoutes.CATALOG) {
            ProductCatalogScreen(
                onNavigateToCart = { navController.navigate(PosRoutes.CART) },
                onCheckout = { navController.navigate(PosRoutes.CHECKOUT) },
                onScanBarcode = { navController.navigate(PosRoutes.SCANNER) },
                onPriceCheck = { navController.navigate(PosRoutes.PRICE_CHECK) },
                onPrinterSettings = { navController.navigate(PosRoutes.PRINTER) },
                onCustomers = { navController.navigate(PosRoutes.CUSTOMERS) },
                navController = navController
            )
        }
        composable(PosRoutes.PRICE_CHECK) {
            PriceCheckScreen(onBack = { navController.popBackStack() })
        }
        composable(PosRoutes.PRINTER) {
            PrinterSettingsScreen(onBack = { navController.popBackStack() })
        }
        composable(PosRoutes.CUSTOMERS) {
            CustomerScreen(onBack = { navController.popBackStack() })
        }
        composable(PosRoutes.SCANNER) {
            BarcodeScannerScreen(
                onBarcodeScanned = { code ->
                    navController.previousBackStackEntry?.savedStateHandle?.set("scannedBarcode", code)
                    navController.popBackStack()
                },
                onClose = { navController.popBackStack() }
            )
        }
        composable(PosRoutes.CART) {
            CartScreen(
                onBack = { navController.popBackStack() },
                onCheckout = { navController.navigate(PosRoutes.CHECKOUT) }
            )
        }
        composable(PosRoutes.CHECKOUT) {
            CheckoutScreen(
                onBack = { navController.popBackStack() },
                onPaymentComplete = { orderId ->
                    navController.navigate("${PosRoutes.PAYMENT_BASE}$orderId") {
                        popUpTo(PosRoutes.CATALOG) { inclusive = false }
                    }
                }
            )
        }
        composable(PosRoutes.PAYMENT) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getString("orderId") ?: ""
            PaymentScreen(
                orderId = orderId,
                onDone = {
                    navController.navigate(PosRoutes.CATALOG) {
                        popUpTo(PosRoutes.CATALOG) { inclusive = true }
                    }
                }
            )
        }
    }
}
