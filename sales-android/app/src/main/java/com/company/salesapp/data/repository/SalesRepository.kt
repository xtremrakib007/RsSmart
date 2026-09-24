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
    suspend fun checkIn(latitude: Double?, longitude: Double?): Result<AttendanceDto> = runCatching {
        val r = api.checkIn(AttendanceRequest(latitude, longitude)); if (r.isSuccessful && r.body()?.success == true) r.body()!!.data else error("Check-in failed")
    }
    suspend fun checkOut(latitude: Double?, longitude: Double?): Result<AttendanceDto> = runCatching {
        val r = api.checkOut(AttendanceRequest(latitude, longitude)); if (r.isSuccessful && r.body()?.success == true) r.body()!!.data else error("Check-out failed")
    }
}
