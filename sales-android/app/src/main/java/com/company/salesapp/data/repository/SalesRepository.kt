package com.company.salesapp.data.repository

import com.company.salesapp.data.remote.api.SalesApi
import com.company.salesapp.data.remote.dto.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SalesRepository @Inject constructor(private val api: SalesApi) {
    suspend fun dashboard(): Result<SalesDashboardDto> = runCatching {
        val r = api.dashboard(); if (r.isSuccessful && r.body()?.success == true) r.body()!!.data else error("Dashboard request failed")
    }
    suspend fun routes(date: String? = null): Result<List<RoutePlanDto>> = runCatching {
        val r = api.routes(date); if (r.isSuccessful && r.body()?.success == true) r.body()!!.data else error("Routes request failed")
    }
    suspend fun checkIn(latitude: Double?, longitude: Double?, photo: String? = null): Result<AttendanceDto> = runCatching {
        val r = api.checkIn(AttendanceRequest(latitude, longitude, photo = photo)); if (r.isSuccessful && r.body()?.success == true) r.body()!!.data else error(errorText(r, "Check-in failed"))
    }
    suspend fun checkOut(latitude: Double?, longitude: Double?, photo: String? = null): Result<AttendanceDto> = runCatching {
        val r = api.checkOut(AttendanceRequest(latitude, longitude, photo = photo)); if (r.isSuccessful && r.body()?.success == true) r.body()!!.data else error(errorText(r, "Check-out failed"))
    }
    suspend fun today(): Result<TodayDto> = runCatching {
        val r = api.today(); if (r.isSuccessful && r.body()?.success == true) r.body()!!.data else error(errorText(r, "Could not load today"))
    }
    suspend fun nearby(lat: Double, lng: Double): Result<List<FieldCustomerDto>> = runCatching {
        val r = api.nearby(lat, lng); if (r.isSuccessful && r.body()?.success == true) r.body()!!.data else error(errorText(r, "Could not load nearby customers"))
    }
    suspend fun teamAttendance(date: String? = null): Result<TeamAttendanceDto> = runCatching {
        val r = api.teamAttendance(date); if (r.isSuccessful && r.body()?.success == true) r.body()!!.data else error(errorText(r, "Could not load the team"))
    }

    // The server's own message (e.g. "Already checked in today.") when there is one.
    private fun errorText(r: retrofit2.Response<*>, fallback: String): String {
        val body = runCatching { r.errorBody()?.string() }.getOrNull().orEmpty()
        val msg = Regex("\"message\"\\s*:\\s*\"([^\"]+)\"").find(body)?.groupValues?.get(1)
        return msg ?: fallback
    }
}
