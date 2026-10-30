import { Module } from '@nestjs/common';
import { PAYMENT_CONTRACT } from './contracts/payment.contract';
import { PaymentContractImpl } from './contracts/payment-contract.impl';

@Module({
  imports: [],
  controllers: [],
  providers: [
    PaymentContractImpl,
    {
      provide: PAYMENT_CONTRACT,
      useClass: PaymentContractImpl,
    },
  ],
  exports: [PAYMENT_CONTRACT],
})
export class PaymentModule {}
