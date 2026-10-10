package com.retail.pos.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.flow.MutableStateFlow
import com.retail.pos.ui.cart.CartScreen
import com.retail.pos.ui.checkout.CheckoutScreen
import com.retail.pos.ui.payment.PaymentScreen
import com.retail.pos.ui.product.ProductCatalogScreen
import com.retail.pos.ui.product.BarcodeScannerScreen
import com.retail.pos.ui.session.SessionScreen

object PosRoutes {
    const val SESSION = "session"
    const val CATALOG = "catalog"
    const val CART = "cart"
    const val SCANNER = "scanner"
    const val CHECKOUT = "checkout"
    const val PAYMENT = "payment/{orderId}"
    const val PAYMENT_BASE = "payment/"
}

@Composable
fun PosNavHost(navController: NavHostController = rememberNavController()) {
    NavHost(
        navController = navController,
        startDestination = PosRoutes.SESSION
    ) {
        composable(PosRoutes.SESSION) {
            SessionScreen(
                onSessionOpen = { navController.navigate(PosRoutes.CATALOG) }
            )
        }
        composable(PosRoutes.CATALOG) {
            val barcodeFlow = navController.currentBackStackEntry
                ?.savedStateHandle
                ?.getStateFlow("scannedBarcode", "")
                ?: MutableStateFlow("")
            val scannedBarcode by barcodeFlow.collectAsState()
            ProductCatalogScreen(
                onNavigateToCart = { navController.navigate(PosRoutes.CART) },
                onCheckout = { navController.navigate(PosRoutes.CHECKOUT) },
                onScanBarcode = { navController.navigate(PosRoutes.SCANNER) },
                scannedBarcode = scannedBarcode,
                onBarcodeConsumed = {
                    navController.currentBackStackEntry?.savedStateHandle?.set("scannedBarcode", "")
                }
            )
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
