/**
 * Token JSON schemas for Fastify validation.
 */

export const createTokenSchema = {
  headers: {
    type: 'object',
    required: ['x-app-id', 'x-app-secret'],
    properties: {
      'x-app-id': { type: 'string', description: 'The app/tenant ID' },
      'x-app-secret': { type: 'string', description: 'The app/tenant secret' },
    },
  },
  params: {
    type: 'object',
    required: ['roomId'],
    properties: {
      roomId: { type: 'string', description: 'The room ID to generate a token for' },
    },
  },
  body: {
    type: 'object',
    required: ['userId', 'role'],
    properties: {
      userId: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        description: 'The user ID to include in the token',
      },
      role: {
        type: 'string',
        enum: ['host', 'participant', 'viewer'],
        description: 'The role of the user in the room',
      },
      expiresIn: {
        type: 'string',
        pattern: '^[0-9]+[smhd]$',
        default: '1h',
        description: 'Token expiration time (e.g., "1h", "30m", "7d")',
      },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;
