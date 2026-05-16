import * as dotenv from 'dotenv';
import * as path from 'path';

// Load root .env.local — works from any service's src/ directory (4 levels up from project root)
dotenv.config({ path: path.resolve(__dirname, '../../', '.env.local') });
