package com.company.salesapp.presentation.field

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/** Call / WhatsApp / directions for a customer (opens the phone's own apps). */
object FieldActions {
    fun call(context: Context, phone: String?) {
        val p = phone?.filter { it.isDigit() || it == '+' }.orEmpty()
        if (p.isEmpty()) { toast(context, "No phone number saved"); return }
        start(context, Intent(Intent.ACTION_DIAL, Uri.parse("tel:$p")))
    }

    fun whatsApp(context: Context, phone: String?) {
        var d = phone?.filter { it.isDigit() }.orEmpty()
        if (d.isEmpty()) { toast(context, "No phone number saved"); return }
        if (d.startsWith("0")) d = "6$d" // Malaysian local number → 60…
        start(context, Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$d")))
    }

    fun directions(context: Context, lat: Double?, lng: Double?, address: String?) {
        val uri = when {
            lat != null && lng != null -> Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$lat,$lng")
            !address.isNullOrBlank() -> Uri.parse("https://www.google.com/maps/dir/?api=1&destination=" + Uri.encode(address))
            else -> { toast(context, "No location or address saved"); return }
        }
        start(context, Intent(Intent.ACTION_VIEW, uri))
    }

    private fun start(context: Context, intent: Intent) {
        try { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { toast(context, "No app can open this") }
    }

    private fun toast(context: Context, msg: String) = Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
}

/** "1.2 km" / "350 m". */
fun formatKm(km: Double?): String = when {
    km == null -> "No location"
    km < 1 -> "${(km * 1000).toInt()} m"
    else -> String.format("%.1f km", km)
}

/** "7h 25m". */
fun formatMinutes(min: Int): String = if (min < 60) "${min}m" else "${min / 60}h ${min % 60}m"
