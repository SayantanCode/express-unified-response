// Tests for response helpers that had no coverage:
// res.deleted(), res.accepted(), res.noContent(), res.updated() with transform,
// and restDefaults config (deleteReturnsNoContent, updateReturnsBody).

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createResponseMiddleware } from "../src/index";

// ─── shared app ──────────────────────────────────────────────────────────────

const app = express();
app.use(createResponseMiddleware());

app.delete("/users/:id", (req, res) => {
  res.deleted();
});

app.delete("/users/:id/with-message", (req, res) => {
  res.deleted(null, "User deleted");
});

app.delete("/users/:id/with-data", (req, res) => {
  res.deleted({ id: req.params.id, name: "Joe" }, "Deleted");
});

app.delete("/users/:id/with-transform", (req, res) => {
  res.deleted(
    { id: req.params.id, password: "secret", name: "Joe" },
    "Deleted",
    { transform: (u: any) => ({ id: u.id, name: u.name }) }
  );
});

app.post("/jobs", (req, res) => {
  res.accepted({ jobId: "abc-123" }, "Job queued");
});

app.post("/jobs/no-data", (req, res) => {
  res.accepted(null, "Processing started");
});

app.post("/trigger", (req, res) => {
  res.noContent();
});

app.patch("/users/:id/silent", (req, res) => {
  res.noContent({ silent: true });
});

app.put("/users/:id", (req, res) => {
  res.updated({ id: req.params.id, name: "Updated Joe" }, "Updated");
});

app.put("/users/:id/transform", (req, res) => {
  res.updated(
    { id: req.params.id, password: "secret", name: "Updated Joe" },
    "Updated",
    { transform: (u: any) => ({ id: u.id, name: u.name }) }
  );
});

app.put("/users/:id/no-data", (req, res) => {
  res.updated();
});

// ─── restDefaults config apps ─────────────────────────────────────────────────

const appNoContent = express();
appNoContent.use(createResponseMiddleware({
  restDefaults: { deleteReturnsNoContent: false, updateReturnsBody: false }
}));

appNoContent.delete("/users/:id", (req, res) => {
  res.deleted();
});

appNoContent.put("/users/:id", (req, res) => {
  res.updated();
});

// ─── tests ───────────────────────────────────────────────────────────────────

describe("res.deleted()", () => {
  it("returns 204 with no body by default (deleteReturnsNoContent: true)", async () => {
    const res = await request(app).delete("/users/1");
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("returns 200 with message when message is provided", async () => {
    const res = await request(app).delete("/users/1/with-message");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("User deleted");
  });

  it("returns 200 with data and message when data is provided", async () => {
    const res = await request(app).delete("/users/1/with-data");
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("1");
    expect(res.body.data.name).toBe("Joe");
  });

  it("applies transform to deleted data", async () => {
    const res = await request(app).delete("/users/1/with-transform");
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Joe");
    expect(res.body.data.password).toBeUndefined();
  });

  it("returns 200 (no 204) when deleteReturnsNoContent is false", async () => {
    const res = await request(appNoContent).delete("/users/1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("res.accepted()", () => {
  it("returns 202 with data and message", async () => {
    const res = await request(app).post("/jobs");
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBe("abc-123");
    expect(res.body.message).toBe("Job queued");
  });

  it("returns 202 with no data", async () => {
    const res = await request(app).post("/jobs/no-data");
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Processing started");
  });
});

describe("res.noContent()", () => {
  it("returns 204 with no body", async () => {
    const res = await request(app).post("/trigger");
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("accepts silent option without throwing", async () => {
    const res = await request(app).patch("/users/1/silent");
    expect(res.status).toBe(204);
  });
});

describe("res.updated() with transform", () => {
  it("returns 200 with transformed data", async () => {
    const res = await request(app).put("/users/1/transform");
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated Joe");
    expect(res.body.data.password).toBeUndefined();
  });

  it("returns 200 when updateReturnsBody is true (default)", async () => {
    const res = await request(app).put("/users/1/no-data");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 204 when updateReturnsBody is false", async () => {
    const res = await request(appNoContent).put("/users/1");
    expect(res.status).toBe(204);
  });
});
