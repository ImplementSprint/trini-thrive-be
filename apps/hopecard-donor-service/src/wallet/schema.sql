-- User wallets table
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_balance DECIMAL(15, 2) DEFAULT 0,
  currency TEXT DEFAULT 'PHP',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT balance_non_negative CHECK (wallet_balance >= 0)
);

-- Wallet transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('topup', 'withdrawal', 'donation')),
  amount DECIMAL(15, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),

  -- Payment reference
  reference_id TEXT, -- PayMongo payment ID for top-ups
  description TEXT, -- e.g., "Top-up via GCash", "Donation to Campaign X"

  -- Metadata for flexibility (e.g., {campaign_id, payment_method, error_reason})
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ, -- When status changed to 'completed'

  CONSTRAINT amount_positive CHECK (amount > 0)
);

-- Stories table for CMS integration
CREATE TABLE IF NOT EXISTS hc_stories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  body TEXT,
  cover_image_url TEXT,
  read_time_minutes INTEGER DEFAULT 3,
  published_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_hc_stories_category ON hc_stories(category);
CREATE INDEX IF NOT EXISTS idx_hc_stories_published_at ON hc_stories(published_at DESC);

-- Enable RLS (Row Level Security) if needed
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hc_stories ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only view their own wallet
CREATE POLICY "users_view_own_wallet" ON user_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_view_own_transactions" ON wallet_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone can view stories
CREATE POLICY "anyone_view_stories" ON hc_stories
  FOR SELECT
  USING (true);
