import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";

import {
  after,
  afterEach,
  before,
  test,
} from "node:test";

import app from "../app.js";
import CustomerNote from "../models/CustomerNote.js";

import {
  getCustomerFollowUpSummary,
  listCustomerFollowUps,
  scheduleCustomerFollowUp,
} from "../services/customerFollowUpService.js";

let server;
let baseUrl;

const originalMethods = {
  countDocuments:
    CustomerNote.countDocuments,
  find: CustomerNote.find,
};

function listQuery(value) {
  const query = {
    populate() {
      return query;
    },
    sort() {
      return query;
    },
    skip() {
      return query;
    },
    limit() {
      return query;
    },
    lean() {
      return Promise.resolve(value);
    },
  };

  return query;
}

before(async () => {
  server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(
      0,
      "127.0.0.1",
      resolve
    );
  });

  const address = server.address();

  baseUrl =
    `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise(
    (resolve, reject) => {
      server.close((error) =>
        error
          ? reject(error)
          : resolve()
      );
    }
  );
});

afterEach(() => {
  CustomerNote.countDocuments =
    originalMethods.countDocuments;

  CustomerNote.find =
    originalMethods.find;
});

for (const request of [
  {
    method: "GET",
    pathname:
      "/api/customer-notes/follow-ups",
  },
  {
    method: "GET",
    pathname:
      "/api/customer-notes/follow-ups/summary",
  },
  {
    method: "PATCH",
    pathname:
      `/api/customer-notes/follow-ups/${new mongoose.Types.ObjectId()}/schedule`,
  },
]) {
  test(
    `${request.method} ${request.pathname} rejects unauthenticated requests`,
    async () => {
      const response = await fetch(
        `${baseUrl}${request.pathname}`,
        {
          method: request.method,
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            request.method === "PATCH"
              ? JSON.stringify({
                  followUpAt:
                    new Date().toISOString(),
                })
              : undefined,
        }
      );

      assert.equal(
        response.status,
        401
      );

      const body =
        await response.json();

      assert.equal(
        body.success,
        false
      );

      assert.equal(
        body.code,
        "AUTHENTICATION_REQUIRED"
      );
    }
  );
}

test(
  "follow-up queue returns paginated and overdue customer notes",
  async () => {
    const now = new Date();
    const noteId =
      new mongoose.Types.ObjectId();

    CustomerNote.find = () =>
      listQuery([
        {
          _id: noteId,
          customer: {
            _id:
              new mongoose.Types.ObjectId(),
            firstName: "Alex",
            lastName: "Morgan",
          },
          title:
            "Check colour result",
          content:
            "Call the customer after the patch test.",
          type: "follow_up",
          visibility: "staff",
          tags: ["colour"],
          pinned: false,
          requiresFollowUp: true,
          followUpAt: new Date(
            now.getTime() - 60_000
          ),
          followUpCompleted: false,
          followUpCompletedAt: null,
          createdBy: {
            name: "Manager",
          },
          updatedBy: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

    CustomerNote.countDocuments =
      async () => 1;

    const result =
      await listCustomerFollowUps(
        {
          state: "overdue",
          page: 1,
          limit: 20,
        },
        {
          viewer: {
            _id:
              new mongoose.Types.ObjectId(),
            role: "manager",
          },
        }
      );

    assert.equal(
      result.pagination.total,
      1
    );

    assert.equal(
      result.followUps.length,
      1
    );

    assert.equal(
      result.followUps[0].isOverdue,
      true
    );

    assert.equal(
      result.followUps[0].title,
      "Check colour result"
    );
  }
);

test(
  "follow-up summary returns operational queue totals",
  async () => {
    const values = [
      5,
      2,
      1,
      2,
      0,
      7,
    ];

    let index = 0;

    CustomerNote.countDocuments =
      async () => values[index++];

    const result =
      await getCustomerFollowUpSummary({
        viewer: {
          _id:
            new mongoose.Types.ObjectId(),
          role: "manager",
        },
      });

    assert.equal(result.open, 5);
    assert.equal(result.overdue, 2);
    assert.equal(result.dueToday, 1);
    assert.equal(result.upcoming, 2);
    assert.equal(result.unscheduled, 0);

    assert.equal(
      result.completedLast30Days,
      7
    );
  }
);

test(
  "scheduling rejects an invalid customer-note identifier",
  async () => {
    await assert.rejects(
      () =>
        scheduleCustomerFollowUp(
          "invalid-id",
          new Date().toISOString(),
          {
            actor: {
              _id:
                new mongoose.Types.ObjectId(),
              role: "manager",
            },
          }
        ),
      (error) => {
        assert.equal(
          error.statusCode,
          400
        );

        assert.equal(
          error.code,
          "INVALID_CUSTOMER_FOLLOW_UP_IDENTIFIER"
        );

        return true;
      }
    );
  }
);
