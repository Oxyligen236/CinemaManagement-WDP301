import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './domain/schemas/payment.schema';
import { PAYMENT_CONTRACT } from './contracts/payment.contract';
import { PaymentContractImpl } from './contracts/payment-contract.impl';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  controllers: [],
  providers: [
    PaymentContractImpl,
    {
      provide: PAYMENT_CONTRACT,
      useClass: PaymentContractImpl,
    },
  ],
  exports: [MongooseModule, PAYMENT_CONTRACT],
})
export class PaymentModule {}
