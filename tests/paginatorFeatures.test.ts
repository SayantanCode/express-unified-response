import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Paginator } from '../src/core/paginator';
import { createResponseMiddleware, createErrorMiddleware } from '../src/index';

const defaults = { page: 1, limit: 10, maxLimit: 100 };

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeQueryModel(docs: any[], totalCount = 50) {
  return {
    find: vi.fn().mockReturnValue({
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(docs),
    }),
    countDocuments: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(totalCount) }),
    estimatedDocumentCount: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(totalCount) }),
  };
}

function makeCursorModel(docs: any[]) {
  return {
    find: vi.fn().mockImplementation(() => ({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(docs),
    })),
  };
}

// ─── skipCount ──────────────────────────────────────────────────────────────

describe('paginateQuery — skipCount', () => {
  it('should not call countDocuments and return totalDocs -1 when skipCount: true', async () => {
    const paginator = new Paginator(defaults as any);
    const model = makeQueryModel([{ _id: '1' }]);

    const result = await paginator.paginateQuery(model as any, { skipCount: true });

    expect(model.countDocuments).not.toHaveBeenCalled();
    expect(result.totalDocs).toBe(-1);
    expect(typeof result.totalPages).toBe('number');
    expect(result.docs).toHaveLength(1);
  });

  it('should not call countDocuments when paginate: false and use docs.length as total', async () => {
    const paginator = new Paginator(defaults as any);
    const docs = [{ _id: '1' }, { _id: '2' }, { _id: '3' }];
    const model = {
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(docs),
      }),
      countDocuments: vi.fn(),
    };

    const result = await paginator.paginateQuery(model as any, { paginate: false });

    expect(model.countDocuments).not.toHaveBeenCalled();
    expect(result.totalDocs).toBe(3);
    expect(result.docs).toHaveLength(3);
  });
});

// ─── useEstimatedCount ───────────────────────────────────────────────────────

describe('paginateQuery — useEstimatedCount', () => {
  it('should call estimatedDocumentCount instead of countDocuments', async () => {
    const paginator = new Paginator(defaults as any);
    const model = makeQueryModel([{ _id: '1' }], 9999);

    const result = await paginator.paginateQuery(model as any, { useEstimatedCount: true });

    expect(model.estimatedDocumentCount).toHaveBeenCalled();
    expect(model.countDocuments).not.toHaveBeenCalled();
    expect(result.totalDocs).toBe(9999);
  });

  it('should warn when useEstimatedCount: true is combined with a non-empty filter', async () => {
    const paginator = new Paginator(defaults as any);
    const model = makeQueryModel([]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await paginator.paginateQuery(model as any, {
      useEstimatedCount: true,
      filter: { active: true },
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('useEstimatedCount'));
    warnSpy.mockRestore();
  });
});

// ─── lean + populate guard ───────────────────────────────────────────────────

describe('lean + populate conflict guard', () => {
  // Minimal duck-type model that passes the Mongoose model check
  const mockMongooseModel: any = {
    find: vi.fn(),
    countDocuments: vi.fn(),
    estimatedDocumentCount: vi.fn(),
    aggregate: vi.fn(),
  };

  it('paginateQuery should throw INVALID_QUERY_OPTIONS when lean and populate are both set', async () => {
    const paginator = new Paginator(defaults as any);

    await expect(
      paginator.paginateQuery(mockMongooseModel, { lean: true, populate: 'profile' })
    ).rejects.toMatchObject({ code: 'INVALID_QUERY_OPTIONS' });
  });

  it('paginateCursor should throw INVALID_QUERY_OPTIONS when lean and populate are both set', async () => {
    const paginator = new Paginator(defaults as any);

    await expect(
      paginator.paginateCursor(mockMongooseModel, { lean: true, populate: 'author' })
    ).rejects.toMatchObject({ code: 'INVALID_QUERY_OPTIONS' });
  });
});

// ─── Cursor pagination ───────────────────────────────────────────────────────

describe('paginateCursor — direction', () => {
  it('should use $gt for asc (default) direction', async () => {
    const paginator = new Paginator({ ...defaults, maxLimit: 10 } as any);
    let capturedFilter: any;
    const model = {
      find: vi.fn().mockImplementation((filter: any) => {
        capturedFilter = filter;
        return { sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([{ _id: 'doc1' }]) };
      }),
    };

    await paginator.paginateCursor(model as any, { cursor: 'cursor123' });

    expect(capturedFilter._id).toEqual({ $gt: 'cursor123' });
  });

  it('should use $lt for desc direction', async () => {
    const paginator = new Paginator({ ...defaults, maxLimit: 10 } as any);
    let capturedFilter: any;
    const model = {
      find: vi.fn().mockImplementation((filter: any) => {
        capturedFilter = filter;
        return { sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([{ _id: 'doc1' }]) };
      }),
    };

    await paginator.paginateCursor(model as any, { cursor: 'cursor123', cursorDirection: 'desc' });

    expect(capturedFilter._id).toEqual({ $lt: 'cursor123' });
  });

  it('should detect hasNextPage using limit+1 and remove the extra doc', async () => {
    const paginator = new Paginator({ page: 1, limit: 2, maxLimit: 10 });
    const model = makeCursorModel([{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]); // 3 for limit=2

    const result = await paginator.paginateCursor(model as any, { limit: 2 });

    expect(result.hasNextPage).toBe(true);
    expect(result.docs).toHaveLength(2);
    expect(result.nextCursor).toBe('b');
  });

  it('should return hasNextPage false and nextCursor null when no extra doc returned', async () => {
    const paginator = new Paginator({ page: 1, limit: 5, maxLimit: 10 });
    const model = makeCursorModel([{ _id: 'x' }, { _id: 'y' }]); // 2 < limit 5

    const result = await paginator.paginateCursor(model as any, { limit: 5 });

    expect(result.hasNextPage).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('should serialize Date cursorField as ISO string', async () => {
    const paginator = new Paginator({ page: 1, limit: 2, maxLimit: 10 });
    const date = new Date('2025-01-15T12:00:00.000Z');
    const model = makeCursorModel([
      { createdAt: date },
      { createdAt: new Date('2025-01-16T12:00:00.000Z') },
      { createdAt: new Date('2025-01-17T12:00:00.000Z') }, // extra doc
    ]);

    const result = await paginator.paginateCursor(model as any, {
      cursorField: 'createdAt',
      limit: 2,
    });

    expect(result.hasNextPage).toBe(true);
    // Must be ISO string, not locale-dependent Date.toString()
    expect(result.nextCursor).toBe('2025-01-16T12:00:00.000Z');
  });
});

// ─── paginateRaw (ORM-agnostic offset pagination) ───────────────────────────

describe('paginateRaw — ORM-agnostic offset pagination', () => {
  it('builds correct PaginatedResult from pre-fetched docs + total', async () => {
    const paginator = new Paginator(defaults as any);
    const docs = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const result = paginator.fromRaw(docs, 30, { page: 2, limit: 3 });

    expect(result.docs).toHaveLength(3);
    expect(result.totalDocs).toBe(30);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(3);
    expect(result.totalPages).toBe(10); // Math.ceil(30/3)
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPrevPage).toBe(true);
    expect(result.nextPage).toBe(3);
    expect(result.prevPage).toBe(1);
  });

  it('does NOT re-slice the docs (no double pagination)', async () => {
    const paginator = new Paginator(defaults as any);
    // Simulate Prisma already fetching page 2 (skip 10, take 10)
    const page2Docs = Array.from({ length: 10 }, (_, i) => ({ id: i + 11 }));

    const result = paginator.fromRaw(page2Docs, 50, { page: 2, limit: 10 });

    // All 10 docs must be in result — no slicing applied
    expect(result.docs).toHaveLength(10);
    expect(result.docs[0]!.id).toBe(11); // first doc on page 2 preserved
  });

  it('does NOT enforce maxLimit — caller controls query', async () => {
    const paginator = new Paginator(defaults as any); // maxLimit: 100
    const bigPage = Array.from({ length: 500 }, (_, i) => ({ id: i }));

    const result = paginator.fromRaw(bigPage, 2000, { page: 1, limit: 500 });

    expect(result.limit).toBe(500); // not capped at 100
    expect(result.docs).toHaveLength(500);
  });

  it('works end-to-end via res.paginateRaw()', async () => {
    const app = express();
    app.use(createResponseMiddleware());

    app.get('/prisma-users', async (req, res) => {
      const prismaPage = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
      await res.paginateRaw(
        prismaPage,
        20,
        { page: 1, limit: 2, transform: (u: any) => ({ userId: u.id, displayName: u.name }) },
        'Users fetched'
      );
    });

    app.use(createErrorMiddleware());

    const res = await request(app).get('/prisma-users');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({ userId: 1, displayName: 'Alice' });
    expect(res.body.meta.totalDocs).toBe(20);
    expect(res.body.meta.totalPages).toBe(10);
    expect(res.body.meta.hasNextPage).toBe(true);
    expect(res.body.message).toBe('Users fetched');
  });
});

// ─── paginateCursorRaw (ORM-agnostic cursor pagination) ─────────────────────

describe('paginateCursorRaw — ORM-agnostic cursor pagination', () => {
  it('builds CursorPaginatedResult from pre-fetched docs + meta', () => {
    const paginator = new Paginator(defaults as any);
    const docs = [{ id: 'a' }, { id: 'b' }];

    const result = paginator.fromCursorRaw(docs, {
      nextCursor: 'b',
      hasNextPage: true,
      limit: 2,
    });

    expect(result.docs).toHaveLength(2);
    expect(result.nextCursor).toBe('b');
    expect(result.hasNextPage).toBe(true);
    expect(result.limit).toBe(2);
  });

  it('works end-to-end via res.paginateCursorRaw()', async () => {
    const app = express();
    app.use(createResponseMiddleware());

    app.get('/prisma-feed', async (req, res) => {
      // Simulating Prisma cursor-based fetch: findMany({ take: limit+1, cursor: ... })
      const rawDocs = [{ id: 'c1', title: 'Post A' }, { id: 'c2', title: 'Post B' }];
      await res.paginateCursorRaw(
        rawDocs,
        { nextCursor: 'c2', hasNextPage: true, limit: 2 },
        { transform: (p: any) => ({ postId: p.id, heading: p.title }) },
        'Feed loaded'
      );
    });

    app.use(createErrorMiddleware());

    const res = await request(app).get('/prisma-feed');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({ postId: 'c1', heading: 'Post A' });
    expect(res.body.meta.nextCursor).toBe('c2');
    expect(res.body.meta.hasNextPage).toBe(true);
    expect(res.body.message).toBe('Feed loaded');
  });
});

// ─── Adapter duplication fix ─────────────────────────────────────────────────

describe('createErrorMiddleware — adapters not duplicated', () => {
  it('should call a custom adapter exactly once per error', async () => {
    const adapterCallCount = { count: 0 };
    
    const countingAdapter = () => {
      adapterCallCount.count++;
      return null; // let built-in handle it
    };

    const app = express();
    app.use(createResponseMiddleware({ adapters: [countingAdapter] }));
    app.get('/err', () => { throw new Error('test'); });
    app.use(createErrorMiddleware({ adapters: [countingAdapter] }));

    await request(app).get('/err');
    expect(adapterCallCount.count).toBe(1); // was 2 before the fix
  });
});

// ─── allowDiskUse ────────────────────────────────────────────────────────────

describe('paginateAggregate — allowDiskUse', () => {
  it('should call allowDiskUse(true) on both aggregate queries', async () => {
    const paginator = new Paginator(defaults as any);
    const allowDiskUseMock = vi.fn().mockReturnThis();

    const model = {
      aggregate: vi.fn().mockImplementation((pipeline: any[]) => {
        const isCount = pipeline.some((s: any) => '$count' in s);
        return {
          allowDiskUse: allowDiskUseMock,
          exec: vi.fn().mockResolvedValue(
            isCount ? [{ totalDocs: 5 }] : [{ _id: 1 }]
          ),
        };
      }),
    };

    await paginator.paginateAggregate(model as any, {
      pipeline: [{ $match: { active: true } }],
      allowDiskUse: true,
    });

    expect(allowDiskUseMock).toHaveBeenCalledWith(true);
    expect(allowDiskUseMock.mock.calls.length).toBe(2); // once for docs, once for count
  });

  it('should NOT call allowDiskUse when allowDiskUse is not set', async () => {
    const paginator = new Paginator(defaults as any);
    const allowDiskUseMock = vi.fn().mockReturnThis();

    const model = {
      aggregate: vi.fn().mockImplementation((pipeline: any[]) => {
        const isCount = pipeline.some((s: any) => '$count' in s);
        return {
          allowDiskUse: allowDiskUseMock,
          exec: vi.fn().mockResolvedValue(isCount ? [{ totalDocs: 1 }] : [{ _id: 1 }]),
        };
      }),
    };

    await paginator.paginateAggregate(model as any, {
      pipeline: [{ $match: { status: 'active' } }],
    });

    expect(allowDiskUseMock).not.toHaveBeenCalled();
  });
});

// ─── paginateAggregate — $limit/$skip strip from count ───────────────────────

describe('paginateAggregate — count pipeline safety', () => {
  it('should strip $limit and $skip stages from the count pipeline', async () => {
    const paginator = new Paginator(defaults as any);
    const pipelines: any[][] = [];

    const model = {
      aggregate: vi.fn().mockImplementation((pipeline: any[]) => {
        pipelines.push(pipeline);
        const isCount = pipeline.some((s: any) => '$count' in s);
        return {
          exec: vi.fn().mockResolvedValue(isCount ? [{ totalDocs: 50 }] : [{ _id: 1 }]),
        };
      }),
    };

    await paginator.paginateAggregate(model as any, {
      pipeline: [
        { $match: { active: true } },
        { $limit: 5 },  // dev accidentally included — should be stripped from count
        { $skip: 10 },  // same
      ],
    });

    const countPipeline = pipelines.find(p => p.some((s: any) => '$count' in s))!;
    expect(countPipeline.some((s: any) => '$limit' in s)).toBe(false);
    expect(countPipeline.some((s: any) => '$skip' in s)).toBe(false);
    expect(countPipeline.some((s: any) => '$match' in s)).toBe(true); // $match kept
  });
});

// ─── MongooseDuplicateKeyError — no value exposure ───────────────────────────

describe('MongooseDuplicateKeyError — security', () => {
  it('should not include the raw field value in the error response', async () => {
    const app = express();
    app.use(createResponseMiddleware());

    app.get('/dup-key', () => {
      const err: any = new Error('E11000 duplicate key error');
      err.name = 'MongoServerError';
      err.code = 11000;
      err.keyValue = { email: 'secret@example.com' };
      throw err;
    });

    app.use(createErrorMiddleware());

    const res = await request(app).get('/dup-key');
    expect(res.status).toBe(400);
    expect(res.body.error.details.field).toBe('email');
    // The actual email value must NOT appear in the error details
    expect(JSON.stringify(res.body)).not.toContain('secret@example.com');
  });
});

// ─── routeNotFound ───────────────────────────────────────────────────────────

describe('createErrorMiddleware — routeNotFound', () => {
  it('should return 404 for unknown routes when routeNotFound is true (default)', async () => {
    const app = express();
    app.use(createResponseMiddleware());
    app.get('/known', (req, res) => res.success({ ok: true }));
    app.use(createErrorMiddleware({ routeNotFound: true }));

    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('should NOT return 404 for unknown routes when routeNotFound: false', async () => {
    const app = express();
    app.use(createResponseMiddleware());
    app.get('/known', (req, res) => res.success({ ok: true }));
    app.use(createErrorMiddleware({ routeNotFound: false }));
    // When routeNotFound is false, Express falls through to its default 404 handler
    app.use((_req, res) => res.status(404).json({ custom: true }));

    const res = await request(app).get('/unknown-route');
    expect(res.body.custom).toBe(true); // our custom handler ran, not the package's
  });
});

// ─── res.list() — nonPaginatedMaxItems DoS protection ───────────────────────

describe('res.list() — nonPaginatedMaxItems enforcement', () => {
  it('caps a non-paginated list at the default 1000 items', async () => {
    const app = express();
    app.use(createResponseMiddleware());

    const hugeArray = Array.from({ length: 5000 }, (_, i) => ({ id: i }));
    app.get('/huge', async (_req, res) => {
      await res.list(hugeArray, { paginate: false });
    });

    const res = await request(app).get('/huge');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1000);
    // totalDocs reflects the true size of the source array, only the payload is capped
    expect(res.body.meta.totalDocs).toBe(5000);
  });

  it('respects a custom nonPaginatedMaxItems value from config', async () => {
    const app = express();
    app.use(createResponseMiddleware({ restDefaults: { nonPaginatedMaxItems: 25 } }));

    const items = Array.from({ length: 200 }, (_, i) => ({ id: i }));
    app.get('/capped', async (_req, res) => {
      await res.list(items, { paginate: false });
    });

    const res = await request(app).get('/capped');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(25);
  });

  it('does not cap when paginate: true — normal page slicing applies instead', async () => {
    const app = express();
    app.use(createResponseMiddleware());

    const items = Array.from({ length: 5000 }, (_, i) => ({ id: i }));
    app.get('/paged', async (_req, res) => {
      await res.list(items, { paginate: true, page: 1, limit: 10 });
    });

    const res = await request(app).get('/paged');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.meta.totalDocs).toBe(5000);
  });
});
