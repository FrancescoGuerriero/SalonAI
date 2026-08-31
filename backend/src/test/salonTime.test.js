import assert
  from "node:assert/strict";

import test
  from "node:test";

import {
  combineSalonDateAndTime,
  formatSalonTime,
  salonDayBounds,
  salonMinutesSinceMidnight,
  toSalonDateKey,
} from "../shared/salonTime.js";

test(
  "London summer booking converts BST wall time to UTC",
  () => {
    const result =
      combineSalonDateAndTime(
        "2026-09-02",
        "12:30"
      );

    assert.equal(
      result.toISOString(),
      "2026-09-02T11:30:00.000Z"
    );

    assert.equal(
      formatSalonTime(
        result
      ),
      "12:30"
    );
  }
);

test(
  "London winter booking keeps GMT wall time aligned with UTC",
  () => {
    const result =
      combineSalonDateAndTime(
        "2026-12-02",
        "12:30"
      );

    assert.equal(
      result.toISOString(),
      "2026-12-02T12:30:00.000Z"
    );

    assert.equal(
      formatSalonTime(
        result
      ),
      "12:30"
    );
  }
);

test(
  "spring DST gap rejects a nonexistent London wall time",
  () => {
    assert.throws(
      () =>
        combineSalonDateAndTime(
          "2026-03-29",
          "01:30"
        ),
      /valid local time/
    );
  }
);

test(
  "autumn DST overlap rejects an ambiguous London wall time",
  () => {
    assert.throws(
      () =>
        combineSalonDateAndTime(
          "2026-10-25",
          "01:30"
        ),
      /ambiguous/
    );
  }
);

test(
  "salon date and minutes are derived in Europe London rather than host timezone",
  () => {
    const result =
      new Date(
        "2026-09-02T11:30:00.000Z"
      );

    assert.equal(
      toSalonDateKey(
        result
      ),
      "2026-09-02"
    );

    assert.equal(
      salonMinutesSinceMidnight(
        result
      ),
      12 * 60 + 30
    );
  }
);

test(
  "London summer day bounds represent the complete local calendar day in UTC",
  () => {
    const {
      start,
      end,
    } =
      salonDayBounds(
        "2026-09-02"
      );

    assert.equal(
      start.toISOString(),
      "2026-09-01T23:00:00.000Z"
    );

    assert.equal(
      end.toISOString(),
      "2026-09-02T22:59:59.999Z"
    );
  }
);

test(
  "salon weekday follows London calendar date across UTC boundary",
  async () => {
    const {
      salonDayOfWeek,
    } =
      await import(
        "../shared/salonTime.js"
      );

    /*
     * 23:30 UTC on 1 September
     * is 00:30 BST on 2 September.
     *
     * 2 September 2026 is Wednesday.
     * Existing SalonAI numbering:
     * Sunday=0 ... Wednesday=3.
     */
    assert.equal(
      salonDayOfWeek(
        new Date(
          "2026-09-01T23:30:00.000Z"
        )
      ),
      3
    );
  }
);

test(
  "sameSalonDay compares London calendar dates rather than UTC dates",
  async () => {
    const {
      sameSalonDay,
    } =
      await import(
        "../shared/salonTime.js"
      );

    assert.equal(
      sameSalonDay(
        new Date(
          "2026-09-01T23:30:00.000Z"
        ),
        new Date(
          "2026-09-02T22:00:00.000Z"
        )
      ),
      true
    );

    assert.equal(
      sameSalonDay(
        new Date(
          "2026-09-02T22:30:00.000Z"
        ),
        new Date(
          "2026-09-02T23:30:00.000Z"
        )
      ),
      false
    );
  }
);

test(
  "salon working-hour minutes use London wall clock",
  async () => {
    const {
      salonMinutesSinceMidnight,
    } =
      await import(
        "../shared/salonTime.js"
      );

    assert.equal(
      salonMinutesSinceMidnight(
        new Date(
          "2026-09-02T11:30:00.000Z"
        )
      ),
      12 * 60 + 30
    );
  }
);
