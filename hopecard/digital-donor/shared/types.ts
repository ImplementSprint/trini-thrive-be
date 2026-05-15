export interface DbProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address: string | null;
  barangay: string | null;
  municipality: string | null;
  province: string | null;
  profile_photo_key: string | null;
  status: string;
  created_at: string;
  total_donations_amount: number;
  total_donations_count: number;
}

export interface DbCampaign {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  target_amount: number;
  collected_amount: number;
  cover_image_key: string | null;
  status: string;
  end_date: string | null;
}

export interface DbCart {
  id: string;
  auth_user_id: string;
  status: string;
}

export interface DbCartItem {
  id: string;
  cart_id: string;
  campaign_id: string;
  face_value: number;
  quantity: number;
  hc_campaigns: {
    title: string;
    category: string | null;
    cover_image_key: string | null;
  } | null;
}

export interface DbPurchase {
  id: string;
  buyer_auth_id: string;
  hopecard_id: string;
  amount_paid: number;
  payment_method: string;
  payment_reference: string;
  status: string;
  purchased_at: string;
}
