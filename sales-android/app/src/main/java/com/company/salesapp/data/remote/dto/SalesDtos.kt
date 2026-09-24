package com.company.salesapp.data.remote.dto

data class SalesDashboardDto(
    val todayOrders: Int = 0,
    val todayRevenue: Double = 0.0,
    val todayVisits: Int = 0,
    val todayCollections: Double = 0.0,
    val target: SalesTargetSummaryDto? = null
)
data class SalesTargetSummaryDto(val amount: Double = 0.0, val achieved: Double = 0.0, val orders: Int = 0)
data class SalesTargetDto(val id: String, val periodStart: String, val periodEnd: String, val targetAmount: Double, val achievedAmount: Double, val targetOrders: Int, val achievedOrders: Int)
data class RoutePlanDto(val id: String, val routeDate: String, val name: String, val status: String, val customerIds: List<String> = emptyList(), val notes: String? = null)
data class AttendanceRequest(val latitude: Double? = null, val longitude: Double? = null, val notes: String? = null)
data class AttendanceDto(val id: String, val workDate: String, val checkInAt: String? = null, val checkOutAt: String? = null, val checkInLat: Double? = null, val checkInLng: Double? = null, val checkOutLat: Double? = null, val checkOutLng: Double? = null)
