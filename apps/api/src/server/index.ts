/**
 * Fastify server bootstrap.
 * Main entry point for the RTC platform API.
 */

import Fastify, { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { config, validateConfig } from '../config';
import { connectDatabase, disconnectDatabase } from '../database';
import { AppError } from '../shared/errors';
import { appRoutes } from '../modules/app';
import { roomRoutes } from '../modules/room';
import { tokenRoutes } from '../modules/token';

/**
 * Builds and configures the Fastify server.
 */
export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        config.env === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
              },
            }
          : undefined,
    },
  });

  // Register CORS
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  // Global error handler
  server.setErrorHandler(
    (error: FastifyError | AppError, _request: FastifyRequest, reply: FastifyReply) => {
      server.log.error(error);

      // Handle typed application errors
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.code,
          message: error.message,
        });
      }

      // Handle Fastify validation errors
      if (error.validation) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: error.message,
        });
      }

      // Handle unknown errors
      return reply.status(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: config.env === 'production' ? 'Internal server error' : error.message,
      });
    }
  );

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register module routes
  await server.register(appRoutes);
  await server.register(roomRoutes);
  await server.register(tokenRoutes);

  return server;
}

/**
 * Starts the server.
 */
export async function startServer(): Promise<void> {
  // Validate configuration
  validateConfig();

  // Connect to database
  await connectDatabase();
  console.log('✅ Connected to database');

  const server = await buildServer();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
    await server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    const address = await server.listen({
      port: config.server.port,
      host: config.server.host,
    });
    server.log.info(`🚀 Server listening at ${address}`);
  } catch (err) {
    server.log.error(err);
    await disconnectDatabase();
    process.exit(1);
  }
}

// Start the server if this is the main module
startServer();
