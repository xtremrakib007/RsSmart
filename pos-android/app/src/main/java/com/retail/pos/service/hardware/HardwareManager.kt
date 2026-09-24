package com.retail.pos.service.hardware

import android.content.Context
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HardwareManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val usbManager: UsbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager

    data class ConnectedDevice(
        val type: DeviceType,
        val name: String,
        val vendorId: Int,
        val productId: Int,
        val isAuthorized: Boolean
    )

    enum class DeviceType {
        PRINTER,
        CASH_DRAWER,
        BARCODE_SCANNER,
        SCALE,
        UNKNOWN
    }

    fun listConnectedDevices(): List<ConnectedDevice> {
        return usbManager.deviceList.values.map { device ->
            ConnectedDevice(
                type = classifyDevice(device),
                name = device.productName ?: "Unknown",
                vendorId = device.vendorId,
                productId = device.productId,
                isAuthorized = usbManager.hasPermission(device)
            )
        }
    }

    fun openCashDrawer() {
        // ESC/POS command to trigger cash drawer kick
        val kickCommand = byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA)
        // This would be sent through the printer connection in practice
    }

    private fun classifyDevice(device: UsbDevice): DeviceType {
        return when {
            device.vendorId == 0x04B8 || device.vendorId == 0x0525 -> DeviceType.PRINTER // Epson / generic
            device.vendorId == 0x0DD4 -> DeviceType.BARCODE_SCANNER // Honeywell example
            else -> DeviceType.UNKNOWN
        }
    }

    fun requestPermission(device: UsbDevice) {
        // Trigger USB permission intent — handled by caller/activity
    }
}
