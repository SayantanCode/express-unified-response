import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Paginator } from '../src/core/paginator';
import { createResponseMiddleware, createErrorMiddleware } from '../src/index';

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
      call[0]!.some((stage: any) => stage.$skip === 5)
    )![0]!;

    expect(dataPipeline).toContainEqual({ $skip: 5 });
    expect(dataPipeline).toContainEqual({ $limit: 5 });
    expect(result.totalDocs).toBe(50);
    expect(result.docs[0].name).toBe('Aggregated Item');
  });
});

describe('res.paginateAggregate — skipCount end-to-end', () => {
  it('skips the count pipeline entirely and returns totalDocs: -1 through a real Express route', async () => {
    let countPipelineCalls = 0;

    const mockModel: any = {
      aggregate: vi.fn().mockImplementation((pipeline: any[]) => ({
        exec: vi.fn().mockImplementation(async () => {
          if (pipeline.some((p) => p.$count)) {
            countPipelineCalls++;
            return [{ totalDocs: 999 }];
          }
          return [{ _id: 1, name: 'Only Data Pipeline Ran' }];
        }),
      })),
    };

    const app = express();
    app.use(createResponseMiddleware());

    app.get('/stats', async (_req, res) => {
      await res.paginateAggregate(
        mockModel,
        { pipeline: [{ $match: { active: true } }], skipCount: true },
        'Stats fetched'
      );
    });

    app.use(createErrorMiddleware());

    const res = await request(app).get('/stats');

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({ _id: 1, name: 'Only Data Pipeline Ran' });
    expect(res.body.meta.totalDocs).toBe(-1);
    // The count pipeline (containing $count) must never have been executed
    expect(countPipelineCalls).toBe(0);
  });
});