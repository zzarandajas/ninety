import { useEffect, useMemo, useState } from 'react';
import { currentQuarter } from '../lib/quarters';
import { quartersApi, type Quarter } from '../lib/quartersApi';
import { useAuthStore } from '../store/authStore';

export interface QuarterOption {
  value: string;
  label: string;
}

export function useQuarterOptions(extraLabels: string[] = []): QuarterOption[] {
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const [quarters, setQuarters] = useState<Quarter[]>([]);

  useEffect(() => {
    let active = true;
    quartersApi
      .list()
      .then((data) => {
        if (active) setQuarters(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeTenantId]);

  const options = useMemo(() => {
    const labels = new Set<string>(extraLabels);
    labels.add(currentQuarter());
    for (const q of quarters) labels.add(q.label);
    return Array.from(labels)
      .sort()
      .map((value) => ({ value, label: value }));
  }, [quarters, extraLabels]);

  return options;
}
