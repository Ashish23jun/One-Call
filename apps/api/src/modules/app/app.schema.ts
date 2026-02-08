/**
 * App (Tenant) JSON schemas for Fastify validation.
 */

export const createAppSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        description: 'The name of the app/tenant',
      },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        secret: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const getAppSchema = {
  params: {
    type: 'object',
    required: ['appId'],
    properties: {
      appId: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const listAppsSchema = {
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
} as const;
