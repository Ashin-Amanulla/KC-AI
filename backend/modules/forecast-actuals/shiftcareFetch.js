import axios from 'axios';
import { config } from '../../config/index.js';

/**
 * Axios instance for ShiftCare API (server-side, env credentials).
 */
export function createShiftCareAxios(credentials) {
  return axios.create({
    baseURL: config.shiftcare.baseUrl,
    auth: {
      username: credentials.accountId,
      password: credentials.apiKey,
    },
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    paramsSerializer: (params) => {
      const searchParams = new URLSearchParams();
      Object.keys(params).forEach((key) => {
        const value = params[key];
        if (Array.isArray(value)) {
          value.forEach((item) => searchParams.append(`${key}[]`, item));
        } else if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      });
      return searchParams.toString();
    },
  });
}
