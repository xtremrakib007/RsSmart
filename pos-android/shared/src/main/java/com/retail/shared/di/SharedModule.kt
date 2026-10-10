package com.retail.shared.di

import android.content.Context
import androidx.room.Room
import com.retail.shared.data.local.database.RetailDatabase
import com.retail.shared.data.local.database.MIGRATION_1_2
import com.retail.shared.sync.SyncApi
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
object SharedModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): RetailDatabase {
        return Room.databaseBuilder(
            context,
            RetailDatabase::class.java,
            "retail_database"
        )
            .addMigrations(MIGRATION_1_2)
            .build()
    }

    @Provides
    fun provideProductDao(db: RetailDatabase) = db.productDao()
    @Provides
    fun provideCartDao(db: RetailDatabase) = db.cartDao()
    @Provides
    fun provideSessionDao(db: RetailDatabase) = db.sessionDao()
    @Provides
    fun provideOrderDao(db: RetailDatabase) = db.orderDao()
    @Provides
    fun provideOfflineQueueDao(db: RetailDatabase) = db.offlineQueueDao()
    @Provides
    fun providePaymentDao(db: RetailDatabase) = db.paymentDao()

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl("https://api.retail.example.com/") // Replace with actual base URL
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideSyncApi(retrofit: Retrofit): SyncApi = retrofit.create(SyncApi::class.java)
}
