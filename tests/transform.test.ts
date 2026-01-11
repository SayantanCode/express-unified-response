// Checking Data Transformation (DTO) Functionality
// (Single object and list of objects transformation using provided function)

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createResponseMiddleware, Paginator } from "../src/index";

describe("Data Transformation (DTO)", () => {
  const app = express();
  app.use(createResponseMiddleware());

  it("should transform a single object", async () => {
    app.get("/single", (req, res) => {
      res.success({ _id: 1, password: "xxx", name: "Joe" }, "User", {
        transform: (doc) => ({ id: doc._id, name: doc.name }),
      });
    });

    const res = await request(app).get("/single");
    expect(res.body.data).toEqual({ id: 1, name: "Joe" });
    expect(res.body.data.password).toBeUndefined();
  });

  it("should transform a list of objects", async () => {
    app.get("/list", (req, res) => {
      const users = [
        { _id: 1, name: "Joe" },
        { _id: 2, name: "Jane" },
      ];
      res.list(users, "Users", {
        transform: (doc: any) => ({
          id: doc._id,
          name: doc.name.toUpperCase(),
        }),
      });
    });

    const res = await request(app).get("/list");
    expect(res.body.data[1].name).toBe("JANE");
  });

  it("should transform aggregate results", async () => {
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

    const result = await paginator.paginateAggregate(
      mockModel,
      { page: 1, limit: 10 },
      (doc: any) => ({ id: doc._id, doubleVal: doc.val * 2 })
    );

    expect(result.docs[0]).toEqual({ id: "123", doubleVal: 20 });
    expect(result.docs[1].doubleVal).toBe(40);
  });
});
