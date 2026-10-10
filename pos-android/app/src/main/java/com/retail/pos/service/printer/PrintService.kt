package com.retail.pos.service.printer

import android.content.Context
import com.dantsu.escposprinter.EscPosPrinter
import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections
import com.dantsu.escposprinter.connection.usb.UsbPrintersConnections
import com.retail.shared.data.local.entity.PosOrder
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PrintService @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val _printState = MutableStateFlow<PrintState>(PrintState.Idle)
    val printState: StateFlow<PrintState> = _printState

    sealed class PrintState {
        object Idle : PrintState()
        object Printing : PrintState()
        object Success : PrintState()
        data class Error(val message: String) : PrintState()
    }

    suspend fun printReceipt(order: PosOrder) = withContext(Dispatchers.IO) {
        _printState.value = PrintState.Printing
        var printer: EscPosPrinter? = null
        try {
            printer = findPrinter()
            if (printer == null) {
                _printState.value = PrintState.Error("No printer found")
                return@withContext
            }

            printer.printFormattedText(buildReceiptText(order))
            _printState.value = PrintState.Success
        } catch (e: Exception) {
            _printState.value = PrintState.Error(e.message ?: "Print failed")
        } finally {
            try {
                printer?.disconnectPrinter()
            } catch (_: Exception) {
                // Keep the original print result if disconnecting fails.
            }
        }
    }

    private fun findPrinter(): EscPosPrinter? {
        // Try USB first, then Bluetooth.
        return try {
            UsbPrintersConnections.selectFirstConnected(context)?.let {
                EscPosPrinter(it, 203, 48f, 32)
            } ?: BluetoothPrintersConnections.selectFirstPaired()?.let {
                EscPosPrinter(it, 203, 48f, 32)
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun buildReceiptText(order: PosOrder): String {
        val date = java.text.SimpleDateFormat(
            "yyyy-MM-dd HH:mm",
            java.util.Locale.getDefault()
        ).format(java.util.Date(order.createdAt))
        val sb = StringBuilder()
        sb.append("[C]<b>RETAIL POS</b>\n")
        sb.append("[C]------------------------------\n")
        sb.append("[L]Receipt: [R]${order.receiptNumber}\n")
        sb.append("[L]Date: [R]$date\n")
        order.customerName?.let { customer ->
            sb.append("[L]Customer: [R]$customer\n")
        }
        sb.append("[C]------------------------------\n")
        sb.append("[L]<b>Total:</b>[R]<b>RM ${"%.2f".format(java.util.Locale.US, order.grandTotal)}</b>\n")
        sb.append("[C]------------------------------\n")
        sb.append("[C]Thank you for your purchase!\n")
        sb.append("[C]\n\n\n")
        return sb.toString()
    }
}
