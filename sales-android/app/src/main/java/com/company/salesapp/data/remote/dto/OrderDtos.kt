package com.company.salesapp.data.remote.dto

data class OrderDto(
    val id: String,
    val orderNumber: String? = null,
    val customerId: String,
    val salesRepId: String,
    val status: String,
    val subtotal: Double,
    val taxAmount: Double,
    val discount: Double = 0.0,
    val total: Double,
    val paidAmount: Double = 0.0,
    val balanceDue: Double = 0.0,
    val notes: String? = null,
    val deliveryDate: String? = null,
    val items: List<OrderItemDto> = emptyList()
)

data class OrderItemDto(
    val productId: String,
    val quantity: Double,
    val unitPrice: Double,
    val discount: Double = 0.0,
    val taxRate: Double = 0.0
)

data class CreateOrderRequest(
    val customerId: String,
    val source: String = "SALES_APP",
    val items: List<OrderItemDto>,
    val discount: Double = 0.0,
    val notes: String? = null,
    val deliveryDate: String? = null
)

data class PaymentDto(
    val amount: Double,
    val method: String,
    val reference: String? = null,
    val notes: String? = null
)
