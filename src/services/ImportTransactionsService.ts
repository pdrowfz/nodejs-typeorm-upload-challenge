import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';
import path from 'path';

import uploadConfig from '../config/upload';

import Category from '../models/Category';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  csvFileName: string;
}

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute({ csvFileName }: Request): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const csvFilePath = path.join(uploadConfig.directory, csvFileName);
    const readStream = fs.createReadStream(csvFilePath);
    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });
    const parseCSV = readStream.pipe(parseStream);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line;

      transactions.push({ title, type, value, category });
      categories.push(category);
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    const storedCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const storedCategoriesTitles = storedCategories.map(
      (category: Category) => category.title,
    );

    const categoriesToAdd = categories
      .filter(category => !storedCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const categoriesToSave = await categoriesRepository.create(
      categoriesToAdd.map(title => ({ title })),
    );

    await categoriesRepository.save(categoriesToSave);

    const allCategories = [...storedCategories, ...categoriesToSave];

    const importedTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(importedTransactions);

    await fs.promises.unlink(csvFilePath);

    return importedTransactions;
  }
}

export default ImportTransactionsService;
