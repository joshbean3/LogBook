import { openDatabase } from './index.js';

const { sqlite } = openDatabase();
sqlite.close();
console.log('Database is up to date.');
