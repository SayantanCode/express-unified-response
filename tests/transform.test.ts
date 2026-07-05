// Checking Data Transformation (DTO) Functionality
// (Single object and list of objects transformation using provided function)

import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createResponseMiddleware, createErrorMiddleware } from "../src/index";
import { Paginator } from "../src/core/paginator";

describe("Data Transformation (DTO)", () => {
  const app = express();
  app.use(createResponseMiddleware());

  it("should transform a single object", async () => {
    app.get("/single", (req, res) => {
      res.success({ id: 1, password: "xxx", name: "Joe", _age: 30 }, "User", {
        transform: (doc) => ({ id: doc.id, name: doc.name, age: doc._age }),
      });
    });

    const res = await request(app).get("/single");
    expect(res.body.data).toEqual({ id: 1, name: "Joe", age: 30 });
    expect(res.body.data.password).toBeUndefined();
  });

  it("should transform a list of objects", async () => {
    app.get("/list", async (_req, res) => {
      const users = [
        { _id: 1, name: "Joe" },
        { _id: 2, name: "Jane" },
      ];
      await res.list(
        users,
        {
          paginate: false,
          transform: (doc) => ({ id: doc._id, name: doc.name.toUpperCase() }),
        },
        "Users"
      );
    });

    const res = await request(app).get("/list");
    expect(res.body.data[1].name).toBe("JANE");
  });

  it("should return raw docs from paginateAggregate (transform is applied by ResponseBuilder, not Paginator)", async () => {
    const defaults = { page: 1, limit: 10, maxLimit: 100 };
    const paginator = new Paginator(defaults as any);
    const mockModel: any = {
      aggregate: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          { _id: "123", val: 10 },
          { _id: "456", val: 20 },
        ]),
      }),
    };

    const result = await paginator.paginateAggregate(mockModel, {
      page: 1,
      limit: 10,
    });

    // Paginator returns raw docs; transform is applied downstream in ResponseBuilder
    expect(result.docs[0]).toEqual({ _id: "123", val: 10 });
    expect(result.docs[1]).toEqual({ _id: "456", val: 20 });
  });

  it("should apply transform to aggregate results through the middleware", async () => {
    const app = express();
    app.use(createResponseMiddleware());

    app.get("/aggregate-transform", async (req, res) => {
      // Simulate aggregate result by using paginateAggregate via list (no real DB needed)
      await res.list(
        [
          { _id: "123", val: 10 },
          { _id: "456", val: 20 },
        ],
        {
          paginate: false,
          transform: (doc: any) => ({ id: doc._id, doubleVal: doc.val * 2 }),
        },
        "Aggregated"
      );
    });

    const res = await request(app).get("/aggregate-transform");
    expect(res.body.data[0]).toEqual({ id: "123", doubleVal: 20 });
    expect(res.body.data[1].doubleVal).toBe(40);
  });
});

describe("Transform — index parameter", () => {
  const app = express();
  app.use(createResponseMiddleware());

  it("passes the item's index as the second argument for array transforms", async () => {
    app.get("/list-index", async (_req, res) => {
      await res.list(
        [{ name: "Joe" }, { name: "Jane" }, { name: "Alex" }],
        { paginate: false, transform: (doc: any, i: number) => ({ position: i, name: doc.name }) }
      );
    });

    const res = await request(app).get("/list-index");
    expect(res.body.data).toEqual([
      { position: 0, name: "Joe" },
      { position: 1, name: "Jane" },
      { position: 2, name: "Alex" },
    ]);
  });

  it("passes index 0 for single-object transforms (res.success)", async () => {
    app.get("/single-index", (_req, res) => {
      res.success({ name: "Joe" }, "OK", {
        transform: (doc: any, i: number) => ({ index: i, name: doc.name }),
      });
    });

    const res = await request(app).get("/single-index");
    expect(res.body.data).toEqual({ index: 0, name: "Joe" });
  });

  it("existing single-argument transform functions still work unchanged", async () => {
    app.get("/legacy-transform", async (_req, res) => {
      await res.list(
        [{ _id: 1, name: "Joe" }],
        { paginate: false, transform: (doc: any) => ({ id: doc._id, name: doc.name }) }
      );
    });

    const res = await request(app).get("/legacy-transform");
    expect(res.body.data).toEqual([{ id: 1, name: "Joe" }]);
  });
});

describe("Transform errors — pinpoint the failing item", () => {
  const app = express();
  app.use(createResponseMiddleware());

  // Routes registered before createErrorMiddleware() — same rule the package's
  // own dev-mode diagnostic (createErrorMiddleware) checks for.
  app.get("/broken-transform", async (_req, res) => {
    await res.list(
      [
        { _id: "a1", name: "Joe", posts: [] },
        { _id: "a2", name: "Jane", posts: [{ title: "Hi" }] },
        { _id: "a3", name: "Alex", posts: null }, // this one will throw
      ],
      {
        paginate: false,
        // Deliberately breaks only on the item with no `posts` array —
        // simulates the "nested structure transform" failure scenario.
        transform: (doc: any) => ({ id: doc._id, postCount: doc.posts.length }),
      }
    );
  });

  app.get("/broken-transform-no-id", async (_req, res) => {
    await res.list(
      [{ value: 1 }, { value: null }],
      { paginate: false, transform: (doc: any) => ({ doubled: doc.value.toFixed(2) }) }
    );
  });

  app.use(createErrorMiddleware());

  it("includes the failing item's index and _id in the error message", async () => {
    const res = await request(app).get("/broken-transform");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("TRANSFORM_ERROR");
    expect(res.body.message).toMatch(/index 2/);
    expect(res.body.message).toMatch(/id: a3/);
  });

  it("does not include an id suffix when the item has no _id/id field", async () => {
    const res = await request(app).get("/broken-transform-no-id");
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/index 1/);
    expect(res.body.message).not.toMatch(/id:/);
  });
});
