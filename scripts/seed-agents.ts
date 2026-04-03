import 'dotenv/config';
import { randomUUID } from 'crypto';
import { Client } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  const client = new Client({ connectionString });
  await client.connect();

  const agents = [
    {
      code: 'ZENO',
      name: 'ZENO',
      role: 'Astrologer',
      domain: 'Astrology',
      personality: 'Logical & Scientific Astrology',
      totalExperts: 12,
      cta: 'Subscribe Now',
      comingSoon: false,
      apiKeyRef: 'ZENO_API_KEY',
      iconKey: 'astrology',
      sortOrder: 1,
      isActive: true,
      searchAliases: ['astro', 'horoscope', 'birth chart', 'future', 'stars', 'prediction'],
      plans: [
        {
          title: 'Explore',
          price: 0,
          description: 'A light starter plan for first-time seekers.',
          features: ['3 questions per day', 'General astrology guidance', 'Short instant answers'],
          cta: 'Choose Explore',
          durationDays: 7,
          isActive: true,
          highlight: false,
          sortOrder: 1,
        },
        {
          title: 'Access',
          price: 99,
          description: 'Best for consistent daily guidance and follow-up.',
          features: ['50 questions', 'Love, career, health, future', 'Remedies included', 'Follow-up questions allowed'],
          cta: 'Choose Access',
          durationDays: 30,
          isActive: true,
          highlight: true,
          sortOrder: 2,
        },
        {
          title: 'Advance',
          price: 299,
          description: 'Deeper predictive guidance and richer context.',
          features: ['250 questions', 'Detailed remedies and timelines', 'Chat history access', 'Context memory'],
          cta: 'Choose Advance',
          durationDays: 90,
          isActive: true,
          highlight: false,
          sortOrder: 3,
        },
        {
          title: 'Unlimited',
          price: 699,
          description: 'Full premium astrology guidance with priority responses.',
          features: ['Unlimited questions', 'Long-form readings', 'Priority responses', 'Deeper life predictions'],
          cta: 'Choose Unlimited',
          durationDays: 365,
          isActive: true,
          highlight: false,
          sortOrder: 4,
        },
      ],
    },
    {
      code: 'ZETA',
      name: 'ZETA',
      role: 'AI Legal Consultant',
      domain: 'Legal',
      personality: 'Analytical & Evidence-Based Legal Advice',
      totalExperts: 122,
      cta: 'Coming Soon',
      comingSoon: true,
      apiKeyRef: 'ZETA_API_KEY',
      iconKey: 'law',
      sortOrder: 2,
      isActive: true,
      searchAliases: ['law', 'legal', 'rights', 'contract', 'evidence', 'case'],
      plans: [
        {
          title: 'Starter',
          price: 149,
          description: 'Early-access legal AI guidance.',
          features: ['25 legal questions', 'Contract and rights guidance', 'Short evidence-based responses'],
          cta: 'Join Waitlist',
          durationDays: 30,
          isActive: true,
          highlight: true,
          sortOrder: 1,
        },
        {
          title: 'Pro Legal',
          price: 399,
          description: 'Deeper legal drafting and evidence-focused guidance.',
          features: ['100 legal questions', 'Contract review help', 'Structured case guidance', 'Priority queue'],
          cta: 'Join Waitlist',
          durationDays: 90,
          isActive: true,
          highlight: false,
          sortOrder: 2,
        },
      ],
    },
    {
      code: 'PSYCHE',
      name: 'PSYCHE',
      role: 'AI Psychologist',
      domain: 'Psychology',
      personality: 'Empathetic & Evidence-Based Therapy',
      totalExperts: 58,
      cta: 'Coming Soon',
      comingSoon: true,
      apiKeyRef: 'PSYCHE_API_KEY',
      iconKey: 'psychology',
      sortOrder: 3,
      isActive: true,
      searchAliases: ['mind', 'mental health', 'therapy', 'emotion', 'stress', 'healing'],
      plans: [
        {
          title: 'Calm',
          price: 129,
          description: 'Gentle support for emotional clarity.',
          features: ['30 guided conversations', 'Stress and reflection support', 'Actionable check-ins'],
          cta: 'Join Waitlist',
          durationDays: 30,
          isActive: true,
          highlight: true,
          sortOrder: 1,
        },
        {
          title: 'Deep Care',
          price: 349,
          description: 'Longer therapeutic-style conversations and reflective journeys.',
          features: ['120 guided chats', 'Mood support', 'Reflective journaling prompts', 'Priority assistance'],
          cta: 'Join Waitlist',
          durationDays: 90,
          isActive: true,
          highlight: false,
          sortOrder: 2,
        },
      ],
    },
  ];

  await client.query('BEGIN');

  try {
    await client.query('DELETE FROM "Agent" WHERE code = ANY($1)', [
      agents.map((agent) => agent.code),
    ]);

    for (const agent of agents) {
      const agentId = randomUUID();
      await client.query(
        `
          INSERT INTO "Agent"
          ("id", "code", "name", "role", "domain", "personality", "totalExperts", "cta", "comingSoon", "apiKeyRef", "iconKey", "sortOrder", "isActive", "searchAliases", "createdAt", "updatedAt")
          VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        `,
        [
          agentId,
          agent.code,
          agent.name,
          agent.role,
          agent.domain,
          agent.personality,
          agent.totalExperts,
          agent.cta,
          agent.comingSoon,
          agent.apiKeyRef,
          agent.iconKey,
          agent.sortOrder,
          agent.isActive,
          agent.searchAliases,
        ],
      );

      for (const plan of agent.plans) {
        await client.query(
          `
            INSERT INTO "AgentPlan"
            ("id", "agentId", "title", "price", "description", "features", "cta", "durationDays", "isActive", "highlight", "sortOrder", "createdAt", "updatedAt")
            VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
          `,
          [
            randomUUID(),
            agentId,
            plan.title,
            plan.price,
            plan.description,
            plan.features,
            plan.cta,
            plan.durationDays,
            plan.isActive,
            plan.highlight,
            plan.sortOrder,
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
