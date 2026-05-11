import mongoose from 'mongoose';
import { config } from './index.js';

let isConnected = false;
let manualShutdown = false;
let reconnectTimer = null;
let reconnectAttempt = 0;

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const scheduleReconnect = () => {
  if (manualShutdown) return;
  const state = mongoose.connection.readyState;
  if (state === 1 || state === 2) return;

  clearReconnectTimer();
  const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (manualShutdown) return;
    if (mongoose.connection.readyState === 1) return;

    try {
      await mongoose.connect(config.mongodb.uri);
      reconnectAttempt = 0;
      isConnected = true;
      console.log('MongoDB reconnected');
    } catch (err) {
      console.error('MongoDB reconnect failed:', err);
      reconnectAttempt += 1;
      scheduleReconnect();
    }
  }, delay);
};

export const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('MongoDB already connected');
    return;
  }

  try {
    await mongoose.connect(config.mongodb.uri);

    isConnected = true;
    reconnectAttempt = 0;
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

/** Call before process exit so we do not fight shutdown with reconnects */
export const markMongoShutdown = () => {
  manualShutdown = true;
  clearReconnectTimer();
};

mongoose.connection.on('connected', () => {
  isConnected = true;
  reconnectAttempt = 0;
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('MongoDB disconnected');
  scheduleReconnect();
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB error:', error);
});
