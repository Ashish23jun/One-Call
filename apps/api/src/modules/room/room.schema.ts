/**
 * Room JSON schemas for Fastify validation.
 */

export const createRoomSchema = {
  headers: {
    type: 'object',
    required: ['x-app-id', 'x-app-secret'],
    properties: {
      'x-app-id': { type: 'string', description: 'The app/tenant ID' },
      'x-app-secret': { type: 'string', description: 'The app/tenant secret' },
    },
  },
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        description: 'The name of the room',
      },
      maxParticipants: {
        type: 'integer',
        minimum: 1,
        maximum: 1000,
        default: 100,
        description: 'Maximum number of participants allowed in the room',
      },
    },
    additionalProperties: false,
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        appId: { type: 'string' },
        name: { type: 'string' },
        maxParticipants: { type: 'integer' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const getRoomSchema = {
  headers: {
    type: 'object',
    required: ['x-app-id', 'x-app-secret'],
    properties: {
      'x-app-id': { type: 'string' },
      'x-app-secret': { type: 'string' },
    },
  },
  params: {
    type: 'object',
    required: ['roomId'],
    properties: {
      roomId: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        appId: { type: 'string' },
        name: { type: 'string' },
        maxParticipants: { type: 'integer' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const listRoomsSchema = {
  headers: {
    type: 'object',
    required: ['x-app-id', 'x-app-secret'],
    properties: {
      'x-app-id': { type: 'string' },
      'x-app-secret': { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          appId: { type: 'string' },
          name: { type: 'string' },
          maxParticipants: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
} as const;
