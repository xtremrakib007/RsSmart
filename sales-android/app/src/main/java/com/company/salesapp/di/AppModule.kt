package com.company.salesapp.di

import android.content.Context
import androidx.room.Room
import com.company.salesapp.data.local.AppDatabase
import com.company.salesapp.data.local.dao.*
import com.company.salesapp.data.remote.AuthInterceptor
import com.company.salesapp.data.remote.api.*
import com.company.salesapp.data.repository.AuthRepository
import com.company.salesapp.gps.LocationTracker
import com.company.salesapp.sync.SyncManager
import com.company.salesapp.util.NetworkConnectivityObserver
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        return OkHttpClient.Builder()
            .apply {
                if (com.company.salesapp.BuildConfig.DEBUG) {
                    addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY })
                }
            }
            .addInterceptor(authInterceptor)
            .addInterceptor { chain ->
                val request = chain.request().newBuilder().addHeader("Accept", "application/json").build()
                chain.proceed(request)
            }
            .build()
    }
    @Provides @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(com.company.salesapp.BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
    @Provides @Singleton fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)
    @Provides @Singleton fun provideCustomerApi(retrofit: Retrofit): CustomerApi = retrofit.create(CustomerApi::class.java)
    @Provides @Singleton fun provideOrderApi(retrofit: Retrofit): OrderApi = retrofit.create(OrderApi::class.java)
    @Provides @Singleton fun provideProductApi(retrofit: Retrofit): ProductApi = retrofit.create(ProductApi::class.java)
    @Provides @Singleton fun provideSyncApi(retrofit: Retrofit): SyncApi = retrofit.create(SyncApi::class.java)
    @Provides @Singleton fun providePushApi(retrofit: Retrofit): PushApi = retrofit.create(PushApi::class.java)
    @Provides @Singleton fun provideSalesApi(retrofit: Retrofit): SalesApi = retrofit.create(SalesApi::class.java)
    @Provides @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(context, AppDatabase::class.java, "sales_app.db").fallbackToDestructiveMigration().build()
    }
    @Provides fun provideSyncEventDao(db: AppDatabase): SyncEventDao = db.syncEventDao()
    @Provides fun provideCustomerDao(db: AppDatabase): CustomerDao = db.customerDao()
    @Provides fun provideOrderDao(db: AppDatabase): OrderDao = db.orderDao()
    @Provides fun provideOrderItemDao(db: AppDatabase): OrderItemDao = db.orderItemDao()
    @Provides fun provideProductDao(db: AppDatabase): ProductDao = db.productDao()
    @Provides fun provideVisitDao(db: AppDatabase): CustomerVisitDao = db.visitDao()
    @Provides fun provideExpenseDao(db: AppDatabase): ExpenseDao = db.expenseDao()
    @Provides @Singleton fun provideNetworkObserver(@ApplicationContext context: Context): NetworkConnectivityObserver = NetworkConnectivityObserver(context)
    @Provides @Singleton fun provideLocationTracker(@ApplicationContext context: Context): LocationTracker = LocationTracker(context)
}
