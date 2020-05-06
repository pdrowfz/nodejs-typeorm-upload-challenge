import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const findIncomes = await this.find({ where: { type: 'income' } });
    const findOutcomes = await this.find({ where: { type: 'outcome' } });

    const valuesReducer = (
      valuesSum: number,
      currentTransaction: Transaction,
    ): number => valuesSum + Number(currentTransaction.value);

    const income = findIncomes.reduce(valuesReducer, 0);
    const outcome = findOutcomes.reduce(valuesReducer, 0);
    const total = income - outcome;

    return { income, outcome, total };
  }
}

export default TransactionsRepository;
