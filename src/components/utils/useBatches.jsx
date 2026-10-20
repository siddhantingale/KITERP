import { useState, useEffect } from 'react';
import { api } from '@/api/client';

let batchCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5000; // 5 seconds

// Global batch refresh mechanism
const batchRefreshListeners = new Set();

export const refreshBatches = () => {
  batchCache = null;
  batchRefreshListeners.forEach(listener => listener());
};

export const useBatches = (options = {}) => {
  const { autoRefresh = true } = options;
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBatches = async () => {
    // Use cache if valid
    const now = Date.now();
    if (batchCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      setBatches(batchCache);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await api.entities.Batch.list();
      batchCache = data;
      cacheTimestamp = Date.now();
      setBatches(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching batches:', err);
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();

    if (autoRefresh) {
      batchRefreshListeners.add(fetchBatches);
      return () => {
        batchRefreshListeners.delete(fetchBatches);
      };
    }
  }, [autoRefresh]);

  // Extract unique years from batches
  const years = [...new Set(batches.filter(b => b.year).map(b => b.year))];

  // Extract unique divisions from batches
  const divisions = [...new Set(batches.filter(b => b.division).map(b => b.division))];

  // Get batches filtered by criteria
  const getFilteredBatches = (year = null, division = null) => {
    return batches.filter(b => {
      if (year && b.year !== year) return false;
      if (division && b.division !== division) return false;
      return true;
    });
  };

  // Get divisions for a specific year
  const getDivisionsForYear = (year) => {
    return [...new Set(batches.filter(b => b.year === year && b.division).map(b => b.division))];
  };

  return {
    batches,
    loading,
    error,
    years,
    divisions,
    refresh: fetchBatches,
    getFilteredBatches,
    getDivisionsForYear
  };
};

// Hook specifically for year/division dropdowns
export const useYearDivisions = () => {
  const { batches, loading, years, divisions, getDivisionsForYear } = useBatches();
  
  return {
    years,
    divisions,
    loading,
    getDivisionsForYear,
    batches
  };
};