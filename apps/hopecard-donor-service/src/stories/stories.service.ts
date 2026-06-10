import { Injectable, HttpException } from '@nestjs/common';
import { supabaseRequest } from '@app/common/supabase-helpers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Story {
  id: string;
  title: string;
  category: string;
  description: string;
  body: string;
  cover_image_url: string;
  read_time_minutes: number;
  published_at: string;
  created_at: string;
}

// Hardcoded stories for seeding
const SEEDED_STORIES = [
  {
    id: 'maria-rebuild',
    title: 'How Maria Rebuilt Her Life After the Floods',
    category: 'Disaster Relief',
    description:
      'Maria lost everything when typhoon rains swept through her barangay. Thanks to your donations, she received emergency housing and livelihood support within 72 hours.',
    body:
      'When the floodwaters rose three meters in less than six hours, Maria Reyes had only minutes to grab her two children and flee their home in Barangay San Lorenzo. The single-room house they had lived in for eleven years was gone by morning — dissolved into the current along with everything they owned.\n\n"I didn\'t know where to go," Maria recalled. "My children were crying, I had nothing. I sat on the highway for hours waiting for someone to tell me what to do next."\n\nWithin 72 hours of the campaign going live on HopeCard, over 4,200 donors had contributed enough to fund emergency housing for 18 displaced families — Maria\'s among them. The funds paid for three months of rental assistance, a starter kit of household essentials, and livelihood training in food processing for the mothers in the group.\n\nSix months later, Maria runs a small kakanin stall near the public market. Her children are back in school. The house she rents is small, but it is hers.\n\n"I want whoever donated to know: you didn\'t just give me money. You gave me the chance to stand back up," she said.',
    cover_image_url: 'https://placehold.co/1200x500/f28d83/ffffff?text=Maria%27s+Story',
    read_time_minutes: 4,
    published_at: '2026-04-12',
  },
  {
    id: 'school-roof',
    title: 'A New Roof for San Isidro Elementary',
    category: 'Education',
    description:
      'Over 200 students now study under a safe, weather-proof roof after the community campaign raised the funds needed for a full structural repair.',
    body:
      'For three consecutive school years, classes at San Isidro Elementary were suspended every time it rained. The aging galvanised iron roof had been patched so many times that teachers kept buckets at the front of each classroom as a matter of routine.\n\nPrincipal Celia Marasigan started the campaign not expecting much. "We had tried government channels for two years," she admitted. "The roof kept getting bumped to next year\'s budget."\n\nThe HopeCard campaign reached its ₱280,000 goal in 19 days, funded by 1,100 individual donors from across the Philippines and the diaspora. Construction took three weeks. When the students returned after the break, the classrooms were dry, bright, and — for the first time — equipped with proper ceiling insulation that kept the rooms cooler during summer.\n\nAttendance in the first month after the repair climbed by 14%. "The children actually want to come to school now," said Grade 3 teacher Reymart Flores. "That is everything."',
    cover_image_url: 'https://placehold.co/1200x500/cda336/ffffff?text=School+Story',
    read_time_minutes: 3,
    published_at: '2026-03-05',
  },
  {
    id: 'clean-water-palawan',
    title: 'Clean Water Reaches 5 Barangays in Palawan',
    category: 'Health & Sanitation',
    description:
      'A solar-powered water pump now serves five remote barangays that previously relied on contaminated streams. The impact on child health has been immediate.',
    body:
      'The five barangays of Sitio Dagat have always been off the grid — no electricity, no road wider than a carabao path, and until recently, no clean water. Residents walked 40 minutes each way to a spring that was shared with livestock.\n\nThe campaign for a solar-powered deep well and distribution line was proposed by a nurse who had served in the area for two years and watched children suffer repeated bouts of waterborne illness.\n\nThe ₱650,000 raised covered the cost of the deep well drilling, a solar pump array, a 10,000-litre holding tank, and a gravity-fed distribution line to five communal faucets — one per barangay.\n\nHealth workers report a 60% drop in diarrhoea cases among children under five in the six months since the system went live. The time women spent collecting water has been redirected to livelihood activities and childcare.\n\n"We used to get sick and just accept it," said Barangay Captain Rodel Magtibay. "Now we know it doesn\'t have to be that way."',
    cover_image_url: 'https://placehold.co/1200x500/4a7c9e/ffffff?text=Water+Story',
    read_time_minutes: 5,
    published_at: '2026-02-18',
  },
  {
    id: 'livelihood-fishing',
    title: 'Fisherfolk Back on the Water With New Equipment',
    category: 'Livelihood',
    description:
      'Twelve fishing families lost their boats to a storm surge. Your contributions funded replacement nets and a shared motorised banca, restoring their primary income.',
    body:
      'Twelve fishing families in Brgy. Pag-asa lost their primary source of income in a single night when a sudden storm surge beached and wrecked their small wooden bancas. The nets — stored aboard — were destroyed too.\n\nWithout boats or gear, families had no way to work and no way to buy food. Community leader Aling Nena organised the HopeCard campaign from her phone, using the barangay\'s single WiFi hotspot.\n\nThe campaign raised ₱190,000, enough to fund: four fibreglass motorised bancas (more durable than wood), twenty sets of multi-filament nets, and a shared storage shed built by the families themselves.\n\nWithin two weeks of the boats arriving, the fishers were back at sea. "The first catch, I cried," said Mang Carding, one of the twelve. "Not because of the fish. Because of what it meant."',
    cover_image_url: 'https://placehold.co/1200x500/97453e/ffffff?text=Fishing+Story',
    read_time_minutes: 4,
    published_at: '2026-01-30',
  },
  {
    id: 'scholar-grad',
    title: 'First in Her Family to Graduate College',
    category: 'Education',
    description:
      'Lena received a scholarship funded entirely through HopeCard donors. She graduated with honours and is now giving back as a teacher in her hometown.',
    body:
      'Lena Buenaventura is the ninth of eleven children. Her father drives a tricycle; her mother sells rice in front of their home in Cavite. When Lena passed the UPCAT, the family celebrated — and then fell silent when the financial reality set in.\n\nThe HopeCard Education Access campaign matched Lena with a scholarship pool funded by recurring monthly donors. Over four years, 340 donors collectively paid for tuition, allowances, and school materials.\n\nLena graduated cum laude with a degree in Elementary Education. She was offered a position at a public school in her home municipality, which she accepted without hesitation.\n\n"I could have taken a private school job with higher pay," she acknowledged. "But the kids in public school are me. They need someone who believes in them."\n\nShe is now in her second year of teaching. Three of her students have announced plans to take college entrance exams. She has started mentoring them after class.',
    cover_image_url: 'https://placehold.co/1200x500/775a00/ffffff?text=Scholar+Story',
    read_time_minutes: 6,
    published_at: '2025-12-10',
  },
  {
    id: 'senior-care',
    title: 'Senior Citizens Get Monthly Medicine Support',
    category: 'Health & Welfare',
    description:
      'A recurring campaign now provides 80 seniors in Quezon City with subsidised medicines every month — a dignity they never expected would be restored.',
    body:
      'For many of the 80 seniors enrolled in the campaign\'s programme, the choice before HopeCard was simple and brutal: medicine or food. Fixed pensions of ₱500 a month do not stretch to cover both.\n\nThe recurring campaign — the first of its kind on HopeCard — delivers pre-packed monthly medicine kits to enrolled seniors through partner community health workers. The kits are tailored to each individual\'s prescription.\n\nSince the programme launched, participating seniors have seen a 45% reduction in emergency hospital visits linked to unmanaged chronic conditions.\n\n"My blood pressure is finally controlled," said 74-year-old Lola Paz. "My daughter used to worry every night. Now she sleeps."\n\nThe campaign is accepting new enrollees. Every ₱250 per month funds one senior\'s medicine kit for a full month.',
    cover_image_url: 'https://placehold.co/1200x500/554240/ffffff?text=Senior+Story',
    read_time_minutes: 3,
    published_at: '2025-11-22',
  },
];

@Injectable()
export class StoriesService {
  async seedStories(): Promise<void> {
    try {
      // Check if stories already exist
      const existing = await supabaseRequest<{ id: string }[]>('hc_stories?limit=1');
      if (existing && existing.length > 0) {
        return; // Already seeded
      }

      // Seed stories
      for (const story of SEEDED_STORIES) {
        await supabaseRequest('hc_stories', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(story),
        });
      }
    } catch (err: unknown) {
      // Silently fail seeding — table might not exist yet
      console.warn('Could not seed stories:', err instanceof Error ? err.message : String(err));
    }
  }

  async getStories(limit: number = 50): Promise<{ stories: Story[] }> {
    try {
      // Seed on first call
      await this.seedStories();

      const stories = await supabaseRequest<Story[]>(
        `hc_stories?order=published_at.desc&limit=${limit}&select=id,title,category,description,cover_image_url,read_time_minutes,published_at,created_at`,
      );

      return { stories };
    } catch (err: unknown) {
      throw new HttpException(
        `DB error fetching stories: ${err instanceof Error ? err.message : String(err)}`,
        500,
      );
    }
  }

  async getStoryById(storyId: string): Promise<{ story: Story }> {
    if (!storyId) throw new HttpException('storyId is required', 400);

    try {
      const stories = await supabaseRequest<Story[]>(
        `hc_stories?id=eq.${storyId}&select=id,title,category,description,body,cover_image_url,read_time_minutes,published_at,created_at`,
      );

      const story = stories?.[0];
      if (!story) {
        throw new HttpException('Story not found', 404);
      }

      return { story };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        `DB error fetching story: ${err instanceof Error ? err.message : String(err)}`,
        500,
      );
    }
  }

  async getStoriesByCategory(category: string, limit: number = 50): Promise<{ stories: Story[] }> {
    if (!category) throw new HttpException('category is required', 400);

    try {
      const stories = await supabaseRequest<Story[]>(
        `hc_stories?category=ilike.${encodeURIComponent(category)}&order=published_at.desc&limit=${limit}&select=id,title,category,description,cover_image_url,read_time_minutes,published_at,created_at`,
      );

      return { stories };
    } catch (err: unknown) {
      throw new HttpException(
        `DB error fetching stories: ${err instanceof Error ? err.message : String(err)}`,
        500,
      );
    }
  }
}
