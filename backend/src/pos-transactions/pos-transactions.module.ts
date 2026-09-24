import { Module } from '@nestjs/common';
import { PosTransactionsController } from './pos-transactions.controller';
import { PosTransactionsService } from './pos-transactions.service';

@Module({ controllers: [PosTransactionsController], providers: [PosTransactionsService], exports: [PosTransactionsService] })
export class PosTransactionsModule {}
