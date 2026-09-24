package com.company.salesapp.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.company.salesapp.data.local.dao.*
import com.company.salesapp.data.local.entity.*

@Database(
    entities = [
        SyncEventEntity::class,
        CustomerEntity::class,
        OrderEntity::class,
        OrderItemEntity::class,
        ProductEntity::class,
        CustomerVisitEntity::class,
        ExpenseEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun syncEventDao(): SyncEventDao
    abstract fun customerDao(): CustomerDao
    abstract fun orderDao(): OrderDao
    abstract fun orderItemDao(): OrderItemDao
    abstract fun productDao(): ProductDao
    abstract fun visitDao(): CustomerVisitDao
    abstract fun expenseDao(): ExpenseDao
}
