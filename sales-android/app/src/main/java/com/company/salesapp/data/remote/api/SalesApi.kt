package com.company.salesapp.data.remote.api

import com.company.salesapp.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.*

interface SalesApi {
    @GET("sales/dashboard")
    suspend fun dashboard(): Response<ApiResponse<SalesDashboardDto>>

    @GET("sales/targets")
    suspend fun targets(): Response<ApiResponse<List<SalesTargetDto>>>

    @GET("sales/routes")
    suspend fun routes(@Query("date") date: String? = null): Response<ApiResponse<List<RoutePlanDto>>>

    @POST("sales/attendance/check-in")
    suspend fun checkIn(@Body request: AttendanceRequest): Response<ApiResponse<AttendanceDto>>

    @POST("sales/attendance/check-out")
    suspend fun checkOut(@Body request: AttendanceRequest): Response<ApiResponse<AttendanceDto>>

    @GET("sales/attendance")
    suspend fun attendance(): Response<ApiResponse<List<AttendanceDto>>>

    @GET("sales/today")
    suspend fun today(): Response<ApiResponse<TodayDto>>

    @GET("sales/customers/nearby")
    suspend fun nearby(@Query("lat") lat: Double, @Query("lng") lng: Double, @Query("limit") limit: Int = 60): Response<ApiResponse<List<FieldCustomerDto>>>

    @GET("sales/team/attendance")
    suspend fun teamAttendance(@Query("date") date: String? = null): Response<ApiResponse<TeamAttendanceDto>>
}
