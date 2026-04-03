import 'dotenv/config';
import { randomUUID } from 'crypto';
import { Client } from 'pg';

function buildAvatarUrl(seed: string) {
  return `https://i.pravatar.cc/300?u=${encodeURIComponent(`venxa-${seed}`)}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  const client = new Client({ connectionString });
  await client.connect();

  const expertsByAgentCode = {
    ZENO: [
      {
        name: 'Dr. Meera Sharma',
        role: 'Astrology Expert',
        bio: 'Specializes in predictive astrology, compatibility, and practical remedies.',
        rating: 4.8,
        pricePerMinute: 40,
        status: 'ONLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 9,
        avatarKey: 'meera-sharma',
        sortOrder: 1,
      },
      {
        name: 'Pandit Raghav Joshi',
        role: 'Vedic Astrologer',
        bio: 'Focuses on birth chart interpretation, career guidance, and timing-based readings.',
        rating: 4.7,
        pricePerMinute: 35,
        status: 'BUSY',
        languages: ['English', 'Hindi'],
        yearsExperience: 12,
        avatarKey: 'raghav-joshi',
        sortOrder: 2,
      },
      {
        name: 'Anisha T',
        role: 'Love & Marriage Astrologer',
        bio: 'Known for relationship guidance, compatibility readings, and emotionally grounded remedies.',
        rating: 4.9,
        pricePerMinute: 23,
        status: 'ONLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 3,
        avatarKey: 'anisha-t',
        sortOrder: 3,
      },
      {
        name: 'Kavya Bhasin',
        role: 'Career Astrologer',
        bio: 'Advises on career timing, job shifts, and professional growth through chart analysis.',
        rating: 4.7,
        pricePerMinute: 28,
        status: 'ONLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 6,
        avatarKey: 'kavya-bhasin',
        sortOrder: 4,
      },
      {
        name: 'Acharya Neel Verma',
        role: 'Vedic Astrologer',
        bio: 'Focuses on doshas, planetary periods, and long-term predictive readings.',
        rating: 4.8,
        pricePerMinute: 32,
        status: 'BUSY',
        languages: ['Hindi', 'English'],
        yearsExperience: 14,
        avatarKey: 'neel-verma',
        sortOrder: 5,
      },
      {
        name: 'Ritika Anand',
        role: 'Relationship Astrologer',
        bio: 'Blends practical advice with chart-based relationship insight and life stage timing.',
        rating: 4.6,
        pricePerMinute: 24,
        status: 'ONLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 5,
        avatarKey: 'ritika-anand',
        sortOrder: 6,
      },
      {
        name: 'Pandit Harsh Vyas',
        role: 'Kundli Specialist',
        bio: 'Works deeply with kundli matching, family matters, and marriage alignment.',
        rating: 4.8,
        pricePerMinute: 29,
        status: 'ONLINE',
        languages: ['Hindi', 'Gujarati'],
        yearsExperience: 10,
        avatarKey: 'harsh-vyas',
        sortOrder: 7,
      },
      {
        name: 'Ishita Rao',
        role: 'Modern Astrology Coach',
        bio: 'Helps users understand personal patterns, confidence cycles, and major transitions.',
        rating: 4.5,
        pricePerMinute: 21,
        status: 'OFFLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 4,
        avatarKey: 'ishita-rao',
        sortOrder: 8,
      },
      {
        name: 'Dev Malhotra',
        role: 'Predictive Astrologer',
        bio: 'Offers event timing, roadmap planning, and focused predictions for key decisions.',
        rating: 4.7,
        pricePerMinute: 31,
        status: 'BUSY',
        languages: ['English', 'Hindi'],
        yearsExperience: 9,
        avatarKey: 'dev-malhotra',
        sortOrder: 9,
      },
      {
        name: 'Siya Kapoor',
        role: 'Female Energy Astrologer',
        bio: 'Guides around emotional well-being, feminine cycles, and self-growth through astrology.',
        rating: 4.8,
        pricePerMinute: 26,
        status: 'ONLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 7,
        avatarKey: 'siya-kapoor',
        sortOrder: 10,
      },
      {
        name: 'Acharya Mohan Das',
        role: 'Spiritual Astrologer',
        bio: 'Specializes in spiritual blocks, karmic themes, and remedy-based consultations.',
        rating: 4.9,
        pricePerMinute: 38,
        status: 'ONLINE',
        languages: ['Hindi', 'English'],
        yearsExperience: 15,
        avatarKey: 'mohan-das',
        sortOrder: 11,
      },
      {
        name: 'Naina Sethi',
        role: 'Marriage & Family Astrologer',
        bio: 'Supports clients navigating love, family alignment, and long-term partnership questions.',
        rating: 4.6,
        pricePerMinute: 25,
        status: 'ONLINE',
        languages: ['English', 'Hindi', 'Punjabi'],
        yearsExperience: 5,
        avatarKey: 'naina-sethi',
        sortOrder: 12,
      },
      {
        name: 'Rohit Kulkarni',
        role: 'Career Timing Expert',
        bio: 'Strong on promotion windows, business timing, and strategic career planning.',
        rating: 4.7,
        pricePerMinute: 30,
        status: 'OFFLINE',
        languages: ['English', 'Hindi', 'Marathi'],
        yearsExperience: 8,
        avatarKey: 'rohit-kulkarni',
        sortOrder: 13,
      },
      {
        name: 'Tanvi Mehta',
        role: 'Life Path Astrologer',
        bio: 'Reads long-term patterns for life direction, purpose, and identity growth.',
        rating: 4.8,
        pricePerMinute: 27,
        status: 'ONLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 6,
        avatarKey: 'tanvi-mehta',
        sortOrder: 14,
      },
      {
        name: 'Pandit Aditya Narayan',
        role: 'Remedial Astrologer',
        bio: 'Expert in practical remedies, ritual suggestions, and planetary strengthening methods.',
        rating: 4.7,
        pricePerMinute: 34,
        status: 'BUSY',
        languages: ['Hindi', 'English'],
        yearsExperience: 13,
        avatarKey: 'aditya-narayan',
        sortOrder: 15,
      },
      {
        name: 'Mira Khatri',
        role: 'Intuitive Astrologer',
        bio: 'Combines intuitive insight with chart interpretation for present-life guidance.',
        rating: 4.5,
        pricePerMinute: 22,
        status: 'ONLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 4,
        avatarKey: 'mira-khatri',
        sortOrder: 16,
      },
      {
        name: 'Arjun Purohit',
        role: 'Traditional Jyotish Expert',
        bio: 'Covers classical jyotish, transits, and long-view planning for major life decisions.',
        rating: 4.8,
        pricePerMinute: 36,
        status: 'ONLINE',
        languages: ['Hindi', 'English'],
        yearsExperience: 11,
        avatarKey: 'arjun-purohit',
        sortOrder: 17,
      },
      {
        name: 'Sonal Arora',
        role: 'Relationship Guide',
        bio: 'Helps decode recurring relationship patterns with warm, practical astrology sessions.',
        rating: 4.6,
        pricePerMinute: 24,
        status: 'ONLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 5,
        avatarKey: 'sonal-arora',
        sortOrder: 18,
      },
      {
        name: 'Yashika Menon',
        role: 'Career & Finance Astrologer',
        bio: 'Focuses on money cycles, work direction, and stable long-term planning.',
        rating: 4.7,
        pricePerMinute: 29,
        status: 'BUSY',
        languages: ['English', 'Hindi'],
        yearsExperience: 7,
        avatarKey: 'yashika-menon',
        sortOrder: 19,
      },
      {
        name: 'Guru Pranav Iyer',
        role: 'Spiritual Guide',
        bio: 'Works on karma, purpose, healing phases, and spiritually aligned next steps.',
        rating: 4.9,
        pricePerMinute: 39,
        status: 'ONLINE',
        languages: ['English', 'Hindi', 'Tamil'],
        yearsExperience: 16,
        avatarKey: 'pranav-iyer',
        sortOrder: 20,
      },
      {
        name: 'Rhea Nair',
        role: 'Modern Vedic Astrologer',
        bio: 'Brings a modern, structured approach to Vedic astrology for young professionals.',
        rating: 4.7,
        pricePerMinute: 26,
        status: 'ONLINE',
        languages: ['English', 'Hindi', 'Malayalam'],
        yearsExperience: 6,
        avatarKey: 'rhea-nair',
        sortOrder: 21,
      },
      {
        name: 'Dhruv Bedi',
        role: 'Transit Specialist',
        bio: 'Strong in short-term transit readings, timing questions, and decision windows.',
        rating: 4.6,
        pricePerMinute: 28,
        status: 'OFFLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 7,
        avatarKey: 'dhruv-bedi',
        sortOrder: 22,
      },
    ],
    PSYCHE: [
      {
        name: 'Dr. Aanya Kapoor',
        role: 'Clinical Psychologist',
        bio: 'Works on emotional regulation, relationships, and burnout recovery.',
        rating: 4.9,
        pricePerMinute: 60,
        status: 'ONLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 11,
        avatarKey: 'aanya-kapoor',
        sortOrder: 1,
      },
    ],
    ZETA: [
      {
        name: 'Adv. Karan Malhotra',
        role: 'Legal Consultant',
        bio: 'Helps with contracts, compliance, and evidence-led practical guidance.',
        rating: 4.6,
        pricePerMinute: 80,
        status: 'OFFLINE',
        languages: ['English', 'Hindi'],
        yearsExperience: 8,
        avatarKey: 'karan-malhotra',
        sortOrder: 1,
      },
    ],
  } as const;

  await client.query('BEGIN');

  try {
    for (const [code, experts] of Object.entries(expertsByAgentCode)) {
      const agentResult = await client.query<{ id: string }>('SELECT id FROM "Agent" WHERE code = $1 LIMIT 1', [
        code,
      ]);

      const agentId = agentResult.rows[0]?.id;
      if (!agentId) continue;

      await client.query('DELETE FROM "Expert" WHERE "agentId" = $1', [agentId]);

      for (const expert of experts) {
        await client.query(
          `
            INSERT INTO "Expert"
            ("id", "agentId", "name", "role", "bio", "aiRating", "aiTestScore", "rating", "pricePerMinute", "status", "languages", "yearsExperience", "avatarKey", "avatarUrl", "isActive", "sortOrder", "createdAt", "updatedAt")
            VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, CAST($10 AS "ExpertStatus"), $11, $12, $13, $14, true, $15, NOW(), NOW())
          `,
          [
            randomUUID(),
            agentId,
            expert.name,
            expert.role,
            expert.bio,
            expert.rating,
            Math.round(expert.rating * 20),
            expert.rating,
            expert.pricePerMinute,
            expert.status,
            expert.languages,
            expert.yearsExperience,
            expert.avatarKey,
            buildAvatarUrl(expert.avatarKey),
            expert.sortOrder,
          ],
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
