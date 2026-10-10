package com.retail.pos.navigation

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.retail.pos.ui.cart.CartScreen
import com.retail.pos.ui.checkout.CheckoutScreen
import com.retail.pos.ui.checkout.ReturnsScreen
import com.retail.pos.ui.payment.PaymentScreen
import com.retail.pos.ui.product.BarcodeScannerScreen
import com.retail.pos.ui.product.PriceCheckScreen
import com.retail.pos.ui.product.ProductCatalogScreen
import com.retail.pos.ui.session.SessionScreen
import com.retail.pos.viewmodel.CartViewModel

object PosRoutes {
    const val SESSION = "session"
    const val CATALOG = "catalog"
    const val CART = "cart"
    const val CHECKOUT = "checkout"
    const val PRICE_CHECK = "price-check"
    const val RETURNS = "returns"
    const val SCANNER = "barcode-scanner"
    const val PAYMENT = "payment/{orderId}"
    const val PAYMENT_BASE = "payment/"
}

@Composable
fun PosNavHost(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = PosRoutes.SESSION) {
        composable(PosRoutes.SESSION) {
            SessionScreen(onSessionOpen = { navController.navigate(PosRoutes.CATALOG) })
        }
        composable(PosRoutes.CATALOG) {
            ProductCatalogScreen(
                onNavigateToCart = { navController.navigate(PosRoutes.CART) },
                onCheckout = { navController.navigate(PosRoutes.CHECKOUT) },
                onScanBarcode = { navController.navigate(PosRoutes.SCANNER) },
                onPriceCheck = { navController.navigate(PosRoutes.PRICE_CHECK) },
                onReturns = { navController.navigate(PosRoutes.RETURNS) }
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
        composable(PosRoutes.RETURNS) {
            ReturnsScreen(
                onBack = { navController.popBackStack() },
                onRefundComplete = { navController.popBackStack() }
            )
        }
        composable(PosRoutes.PRICE_CHECK) {
            PriceCheckScreen(
                onBack = { navController.popBackStack() },
                onScanBarcode = { navController.navigate(PosRoutes.SCANNER) }
            )
        }
        composable(PosRoutes.SCANNER) {
            val previousEntry = navController.previousBackStackEntry
            if (previousEntry != null) {
                val cartViewModel: CartViewModel = hiltViewModel(previousEntry)
                BarcodeScannerScreen(
                    onBarcodeScanned = { code ->
                        cartViewModel.setSearchQuery(code)
                        navController.popBackStack()
                    },
                    onClose = { navController.popBackStack() },
                    viewModel = cartViewModel
                )
            } else {
                Text("Open the barcode scanner from the product catalog or Price Check screen.")
            }
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
