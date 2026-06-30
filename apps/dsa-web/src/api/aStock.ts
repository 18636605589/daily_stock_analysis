import apiClient from './index';
import { toCamelCase } from './utils';
import type {
  DailySnapshotResponse,
  DatedFileItem,
  DataStatusResponse,
  FactorICResponse,
  NextRecommendationsResponse,
  PerformanceResponse,
  PremarketReviewResponse,
} from '../types/aStock';

export const aStockApi = {
  async getStatus(): Promise<DataStatusResponse> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/a-stock/status');
    return toCamelCase<DataStatusResponse>(response.data);
  },

  async getNext(): Promise<NextRecommendationsResponse> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/a-stock/next');
    return toCamelCase<NextRecommendationsResponse>(response.data);
  },

  async listPremarket(): Promise<DatedFileItem[]> {
    const response = await apiClient.get<unknown[]>('/api/v1/a-stock/premarket/list');
    return toCamelCase<DatedFileItem[]>(response.data);
  },

  async getLatestPremarket(): Promise<PremarketReviewResponse> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/a-stock/premarket/latest');
    return toCamelCase<PremarketReviewResponse>(response.data);
  },

  async getPremarket(date: string): Promise<PremarketReviewResponse> {
    const response = await apiClient.get<Record<string, unknown>>(`/api/v1/a-stock/premarket/${date}`);
    return toCamelCase<PremarketReviewResponse>(response.data);
  },

  async listDaily(): Promise<DatedFileItem[]> {
    const response = await apiClient.get<unknown[]>('/api/v1/a-stock/daily/list');
    return toCamelCase<DatedFileItem[]>(response.data);
  },

  async getDaily(date: string): Promise<DailySnapshotResponse> {
    const response = await apiClient.get<Record<string, unknown>>(`/api/v1/a-stock/daily/${date}`);
    return toCamelCase<DailySnapshotResponse>(response.data);
  },

  async getFactorIc(): Promise<FactorICResponse> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/a-stock/factor-ic');
    return toCamelCase<FactorICResponse>(response.data);
  },

  async getPerformance(): Promise<PerformanceResponse> {
    const response = await apiClient.get<Record<string, unknown>>('/api/v1/a-stock/performance');
    return toCamelCase<PerformanceResponse>(response.data);
  },
};
