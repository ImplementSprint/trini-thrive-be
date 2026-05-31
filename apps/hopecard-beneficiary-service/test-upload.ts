import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function testUpload() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin.storage.listBuckets();
  if (error) {
    console.error('ERROR:', error);
  } else {
    console.log('Buckets:', data?.map(b => b.name));
  }
}

testUpload().catch(console.error);
