import { WorkflowNode } from '../types';

export const MOCK_NODES: WorkflowNode[] = [
  {
    id: '1',
    name: 'Webhook',
    type: 'trigger',
    data: {
      headers: {
        host: 'n8n.instance.com',
        'user-agent': 'PostmanRuntime/7.29.0',
        accept: '*/*',
      },
      query: {
        id: '12345',
        source: 'campaign_email',
      },
      body: {
        user_id: 8842,
        email: 'alice.doe@example.com',
        created_at: '2023-11-15T14:30:00.000Z',
        preferences: {
          newsletter: true,
          notifications: false,
        },
        tags: ['lead', 'qualified', 'urgent'],
      },
    },
  },
  {
    id: '2',
    name: 'Stripe',
    type: 'action',
    data: {
      customer: {
        id: 'cus_N8nExample99',
        balance: 0,
        currency: 'usd',
        delinquent: false,
      },
      last_charge: {
        id: 'ch_123456',
        amount: 2900,
        currency: 'usd',
        status: 'succeeded',
        created: 1700050000,
      },
    },
  },
  {
    id: '3',
    name: 'Transform',
    type: 'function',
    data: {
      calculatedScore: 95.5,
      processedDate: new Date().toISOString(),
      isPremium: true,
      summary: 'Customer is in good standing.',
    },
  },
];