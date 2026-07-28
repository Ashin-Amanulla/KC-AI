import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { nameMatchKeys, normStaffNameForMatch } from '../lib/staffNameNorm';

export const STAFF_RATES_KEY = 'staff-rates';

/** @param {Array} rows - API staffRates array */
export function staffRatesArrayToMap(rows) {
  const m = new Map();
  for (const r of rows || []) {
    if (!r?.rates) continue;
    const ratesObj = {
      ...r.rates,
      name: r.rates.name || r.staffName,
      aliases: Array.isArray(r.aliases) ? r.aliases : [],
    };
    const canonical = normStaffNameForMatch(r.staffName) || r.normName;
    if (!canonical) continue;

    const addKey = (key) => {
      if (key && !m.has(key)) m.set(key, ratesObj);
    };

    addKey(canonical);
    if (r.normName && r.normName !== canonical) addKey(r.normName);

    for (const k of nameMatchKeys(r.staffName)) addKey(k);

    if (Array.isArray(r.aliases)) {
      for (const alias of r.aliases) {
        if (!alias) continue;
        for (const k of nameMatchKeys(alias)) addKey(k);
        addKey(alias);
      }
    }
  }
  return m;
}

export { enrichCostMapWithStaffRateAliases } from '../lib/staffCostMapEnrich';

export const useStaffRates = (locationId) => {
  return useQuery({
    queryKey: [STAFF_RATES_KEY, locationId],
    queryFn: async () => {
      const response = await api.get('/api/staff-rates', {
        params: { locationId },
      });
      return response.data;
    },
    enabled: Boolean(locationId),
    staleTime: 30_000,
  });
};

export const useUpsertStaffRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const response = await api.put('/api/staff-rates', body);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      if (variables?.locationId) {
        queryClient.invalidateQueries({ queryKey: [STAFF_RATES_KEY, variables.locationId] });
      }
      queryClient.invalidateQueries({ queryKey: [STAFF_RATES_KEY] });
    },
  });
};

export const useDeleteStaffRate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ locationId, shiftcareStaffId }) => {
      const response = await api.delete('/api/staff-rates', {
        params: { locationId, shiftcareStaffId },
      });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      if (variables?.locationId) {
        queryClient.invalidateQueries({ queryKey: [STAFF_RATES_KEY, variables.locationId] });
      }
      queryClient.invalidateQueries({ queryKey: [STAFF_RATES_KEY] });
    },
  });
};

export const useBulkImportStaffRates = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ locationId, rows }) => {
      const response = await api.post('/api/staff-rates/bulk', { locationId, rows });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      if (variables?.locationId) {
        queryClient.invalidateQueries({ queryKey: [STAFF_RATES_KEY, variables.locationId] });
      }
      queryClient.invalidateQueries({ queryKey: [STAFF_RATES_KEY] });
    },
  });
};
