import { getConfig } from '../lib/config.mjs';
import { migrate } from './migrate.mjs';
getConfig();
migrate();
console.log('Configuration valid; database ready.');
