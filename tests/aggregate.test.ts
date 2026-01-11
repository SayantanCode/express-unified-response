import { describe, it, expect, vi } from 'vitest';
import { Paginator } from '../src/core/paginator';

describe('Paginator.paginateAggregate', () => {
  const defaults = { page: 1, limit: 10, maxLimit: 100 };

  it('should correctly append pagination stages to the pipeline', async () => {
    const paginator = new Paginator(defaults as any);

    // Mock Model
    const mockModel: any = {
      aggregate: vi.fn().mockImplementation((pipeline: any[]) => ({
        // We return an object with an exec method to simulate Mongoose's chainable API
        exec: vi.fn().mockImplementation(async () => {
          // Check if this specific pipeline call is for counting
          if (pipeline.some((p) => p.$count)) {
            return [{ totalDocs: 50 }];
          }
          // Otherwise, it's the data pipeline
          return [{ _id: 1, name: 'Aggregated Item' }];
        }),
      })),
    };

    const options = {
      page: 2,
      limit: 5,
      pipeline: [{ $match: { status: 'active' } }]
    };

    const result = await paginator.paginateAggregate(mockModel, options);

    // 1. Verify the aggregate calls
    const calls = mockModel.aggregate.mock.calls;
    
    // The first call (or one of them) should be the data pipeline with $skip/$limit
    const dataPipeline = calls.find((call: any[][]) => 
      call[0].some((stage: any) => stage.$skip === 5)
    )[0];

    expect(dataPipeline).toContainEqual({ $skip: 5 });
    expect(dataPipeline).toContainEqual({ $limit: 5 });
    expect(result.totalDocs).toBe(50);
    expect(result.docs[0].name).toBe('Aggregated Item');
  });
});