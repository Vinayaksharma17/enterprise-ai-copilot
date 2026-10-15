import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'NODE_ENV',
  'BACKEND_PORT',
  'MONGODB_URI',
  'MONGODB_DATABASE',
  'REDIS_URL',
  'CHROMA_URL',
  'CORS_ORIGIN',
  'JWT_ACCESS_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'BCRYPT_ROUNDS',
];

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

export const config = {
  nodeEnv: process.env.NODE_ENV as string,
  port: parseInt(process.env.BACKEND_PORT as string, 10),
  mongodb: {
    uri: process.env.MONGODB_URI as string,
    database: process.env.MONGODB_DATABASE as string,
  },
  redis: {
    url: process.env.REDIS_URL as string,
  },
  chroma: {
    url: process.env.CHROMA_URL as string,
  },
  cors: {
    origin: process.env.CORS_ORIGIN as string,
  },
  jwt: {
    secret: process.env.JWT_ACCESS_SECRET as string,
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN as string,
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS as string, 10),
  },
};
