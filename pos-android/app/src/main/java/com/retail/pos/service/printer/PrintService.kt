package com.retail.pos.service.printer

import android.content.Context
import com.dantsu.escposprinter.EscPosPrinter
import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections
import com.dantsu.escposprinter.connection.tcp.TcpConnection
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
        try {
            val printer = findPrinter()
            if (printer == null) {
                _printState.value = PrintState.Error("No printer found")
                return@withContext
            }

            val text = buildReceiptText(order)
            printer.printFormattedText(text)
            printer.disconnectPrinter()
            _printState.value = PrintState.Success
        } catch (e: Exception) {
            _printState.value = PrintState.Error(e.message ?: "Print failed")
        }
    }

    private fun findPrinter(): EscPosPrinter? {
        // Try USB first, then Bluetooth, then TCP fallback
        return try {
            UsbPrintersConnections.selectFirstConnected(context)?.let {
                EscPosPrinter(it, 203, 48f, 32)
            } ?: BluetoothPrintersConnections.selectFirstPaired()?.let {
                EscPosPrinter(it, 203, 48f, 32)
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun buildReceiptText(order: PosOrder): String {
        val sb = StringBuilder()
        sb.append("[C]<b>RETAIL POS</b>
")
        sb.append("[C]------------------------------
")
        sb.append("[L]Receipt: [R]${order.receiptNumber}
")
        sb.append("[L]Date: [R]${java.text.SimpleDateFormat("yyyy-MM-dd HH:mm").format(java.util.Date(order.createdAt))}
")
        if (order.customerName != null) {
            sb.append("[L]Customer: [R]${order.customerName}
")
        }
        sb.append("[C]------------------------------
")
        sb.append("[L]<b>Total:</b>[R]<b>$${"%.2f".format(order.grandTotal)}</b>
")
        sb.append("[C]------------------------------
")
        sb.append("[C]Thank you for your purchase!
")
        sb.append("[C]


")
        return sb.toString()
    }
}
