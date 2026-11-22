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
// photo: optional selfie as a data URL (data:image/jpeg;base64,...)
data class AttendanceRequest(val latitude: Double? = null, val longitude: Double? = null, val notes: String? = null, val photo: String? = null)
data class AttendanceDto(val id: String, val workDate: String, val checkInAt: String? = null, val checkOutAt: String? = null, val checkInLat: Double? = null, val checkInLng: Double? = null, val checkOutLat: Double? = null, val checkOutLng: Double? = null)

// ── Phase 37 field sales ──────────────────────────────────────
data class FieldCustomerDto(
    val id: String,
    val code: String? = null,
    val name: String,
    val phone: String? = null,
    val address: String? = null,
    val city: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val balance: Double? = null,
    val creditLimit: Double? = null,
    val category: String? = null,
    val routeName: String? = null,
    val assignedRepId: String? = null,
    val distanceKm: Double? = null,
    val visitedAt: String? = null
)
data class TodayAttendanceDto(
    val status: String = "NOT_IN",
    val minutesWorked: Int = 0,
    val checkInAt: String? = null,
    val checkOutAt: String? = null
)
data class TodayRouteDto(
    val id: String,
    val name: String,
    val status: String? = null,
    val notes: String? = null,
    val stops: List<FieldCustomerDto> = emptyList(),
    val visited: Int = 0
)
data class TodayDto(
    val attendance: TodayAttendanceDto = TodayAttendanceDto(),
    val routes: List<TodayRouteDto> = emptyList(),
    val visitsToday: Int = 0
)
data class TeamMemberDto(
    val userId: String,
    val name: String,
    val phone: String? = null,
    val status: String = "NOT_IN",
    val minutesWorked: Int = 0,
    val checkInAt: String? = null,
    val checkOutAt: String? = null,
    val checkInLat: Double? = null,
    val checkInLng: Double? = null,
    val checkInPhotoUrl: String? = null,
    val checkOutPhotoUrl: String? = null
)
data class TeamSummaryDto(val total: Int = 0, val `in`: Int = 0, val out: Int = 0, val notIn: Int = 0)
data class TeamAttendanceDto(val date: String? = null, val summary: TeamSummaryDto = TeamSummaryDto(), val team: List<TeamMemberDto> = emptyList())
