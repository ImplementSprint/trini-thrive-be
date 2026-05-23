export type CampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export class Campaign {
  id!: string;
  title!: string;
  category!: string | null;
  description!: string | null;
  target_amount!: number;
  collected_amount!: number;
  donor_count!: number;
  start_date!: string | null;
  end_date!: string | null;
  cover_image_key!: string | null;
  status!: CampaignStatus;
  created_by!: string;
  created_at!: string;
}
