import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildGrid } from "./grid.ts"
import {
  collectPostedTasks,
  dataForSeoErrorMessage,
  finalizeGridCells,
  isEmptySerpMessage,
  postedTasksFromResponse,
  scanMapsGrid,
  type MapsGridClient,
  type MapsItem,
  type MapsTaskSnapshot,
  type PostedMapsTask,
} from "./dataforseo.ts"

function gridPoint(id: string, row: number, col: number) {
  return {
    id,
    row,
    col,
    lat: 30.27 + row * 0.01,
    lng: -97.74 + col * 0.01,
    zoom: 17,
    locationCoordinate: `30.27${row},-97.74${col},17z`,
  }
}

function ninePoints() {
  return Array.from({ length: 9 }, (_, index) => gridPoint(`${Math.floor(index / 3)}:${index % 3}`, Math.floor(index / 3), index % 3))
}

function mapsItem(title: string, placeId: string, rank: number): MapsItem {
  return {
    type: "maps_search",
    rank_group: rank,
    title,
    place_id: placeId,
    address: "900 E 11th St, Austin, TX",
  }
}

describe("empty SERP handling", () => {
  it("treats No Search Results as a finished empty cell, not an auth error", () => {
    assert.equal(isEmptySerpMessage("No Search Results."), true)
    assert.equal(
      dataForSeoErrorMessage(
        { status_code: 40102, status_message: "No Search Results.", tasks: [{ status_code: 40102, status_message: "No Search Results." }] },
        200,
      ),
      null,
    )
  })
})

describe("postedTasksFromResponse", () => {
  it("keeps our request tag when the response omits data.tag", () => {
    const requested = [
      { language_code: "en" as const, location_coordinate: "30.27,-97.74,17z", keyword: "barbecue", depth: 20, search_places: false, search_this_area: true, tag: "0:0" },
      { language_code: "en" as const, location_coordinate: "30.28,-97.74,17z", keyword: "barbecue", depth: 20, search_places: false, search_this_area: true, tag: "0:1" },
    ]
    const mapped = postedTasksFromResponse(requested, [
      { id: "task-a", status_code: 20100 },
      { id: "task-b", status_code: 20100 },
    ])
    assert.deepEqual(
      mapped.posted.map((row) => [row.id, row.tag]),
      [
        ["task-a", "0:0"],
        ["task-b", "0:1"],
      ],
    )
    assert.equal(mapped.failed.length, 0)
  })
})

describe("scanMapsGrid", () => {
  it("gives every pin a completed SERP or error after finalize", async () => {
    const points = ninePoints()
    const client: MapsGridClient = {
      postTasks: async () => points.map((point, index) => ({ id: `task-${index}`, tag: point.id })),
      getTask: async (id) => {
        const index = Number(id.replace("task-", ""))
        if (index < 6) {
          return {
            id,
            status_code: 20000,
            result: [{ items: index === 1 ? [] : [mapsItem("Franklin Barbecue", "ChIJ-franklin", 2)] }],
          }
        }
        return { id, status_code: 40602 }
      },
      liveAtCoordinate: async (_keyword, point) => {
        if (point.id === "2:2") return { items: [], error: "Maps search timed out." }
        return { items: [mapsItem("Franklin Barbecue", "ChIJ-franklin", 4)], error: null }
      },
    }

    const cells = await scanMapsGrid(points, "barbecue", "login", "password", {
      client,
      pollTimeoutMs: 20,
      sleep: async () => {},
    })

    assert.equal(cells.length, 9)
    assert.ok(cells.every((cell) => cell.point.id))
    const withItems = cells.filter((cell) => cell.items.length > 0)
    const emptyOk = cells.filter((cell) => cell.items.length === 0 && !cell.error)
    const errored = cells.filter((cell) => cell.error)
    assert.equal(withItems.length + emptyOk.length + errored.length, 9)
    assert.ok(errored.some((cell) => cell.point.id === "2:2"))
    assert.ok(emptyOk.some((cell) => cell.point.id === "0:1"))
  })

  it("fills remaining pins from live fallback when task_get is only partial", async () => {
    const points = ninePoints()
    const liveHits: string[] = []
    const client: MapsGridClient = {
      postTasks: async () => points.slice(0, 4).map((point) => ({ id: `ready-${point.id}`, tag: point.id })),
      getTask: async (id) => ({
        id,
        status_code: 20000,
        result: [{ items: [mapsItem("Franklin Barbecue", "ChIJ-franklin", 1)] }],
      }),
      liveAtCoordinate: async (_keyword, point) => {
        liveHits.push(point.id)
        return { items: [mapsItem("Franklin Barbecue", "ChIJ-franklin", 8)], error: null }
      },
    }

    const cells = await scanMapsGrid(points, "barbecue", "login", "password", {
      client,
      pollTimeoutMs: 20,
      sleep: async () => {},
    })

    assert.equal(cells.length, 9)
    assert.equal(liveHits.length, 5)
    assert.deepEqual(liveHits.sort(), ["1:1", "1:2", "2:0", "2:1", "2:2"])
    assert.ok(cells.every((cell) => cell.items.length > 0 && !cell.error))
  })

  it("marks No Search Results as a completed empty SERP", async () => {
    const points = [gridPoint("0:1", 0, 1)]
    const client: MapsGridClient = {
      postTasks: async () => [{ id: "empty-1", tag: "0:1" }],
      getTask: async () => ({
        id: "empty-1",
        status_code: 40102,
        status_message: "No Search Results.",
        result: [{ items: [] }],
      }),
      liveAtCoordinate: async () => {
        throw new Error("live fallback should not run for an empty SERP")
      },
    }
    const cells = await scanMapsGrid(points, "barbecue", "login", "password", {
      client,
      pollTimeoutMs: 20,
      sleep: async () => {},
    })
    assert.equal(cells[0]?.error, null)
    assert.deepEqual(cells[0]?.items, [])
  })

  it("keeps scanning when one pin throws", async () => {
    const points = ninePoints()
    const client: MapsGridClient = {
      postTasks: async () => points.map((point) => ({ id: `task-${point.id}`, tag: point.id })),
      getTask: async (id) => {
        if (id === "task-0:0") throw new Error("task_get failed")
        return {
          id,
          status_code: 20000,
          result: [{ items: [mapsItem("Franklin Barbecue", "ChIJ-franklin", 2)] }],
        }
      },
      liveAtCoordinate: async (_keyword, point) => {
        if (point.id === "0:0") throw new Error("live failed")
        return { items: [mapsItem("Franklin Barbecue", "ChIJ-franklin", 4)], error: null }
      },
    }
    const cells = await scanMapsGrid(points, "barbecue", "login", "password", {
      client,
      pollTimeoutMs: 20,
      sleep: async () => {},
    })
    assert.equal(cells.length, 9)
    const failed = cells.filter((cell) => cell.error)
    const ok = cells.filter((cell) => !cell.error)
    assert.equal(failed.length, 1)
    assert.equal(failed[0]?.point.id, "0:0")
    assert.match(failed[0]?.error || "", /Could not reach Maps/)
    assert.equal(ok.length, 8)
  })

  it("reports each finished pin so live status can advance", async () => {
    const points = ninePoints()
    const seen: string[] = []
    const client: MapsGridClient = {
      postTasks: async () => points.map((point) => ({ id: `task-${point.id}`, tag: point.id })),
      getTask: async (id) => ({
        id,
        status_code: 20000,
        result: [{ items: [mapsItem("Franklin Barbecue", "ChIJ-franklin", 1)] }],
      }),
      liveAtCoordinate: async () => {
        throw new Error("live fallback should not run")
      },
    }
    await scanMapsGrid(points, "barbecue", "login", "password", {
      client,
      pollTimeoutMs: 20,
      sleep: async () => {},
      onCell: (cell, done) => {
        seen.push(`${cell.point.id}:${done}`)
      },
    })
    assert.equal(seen.length, 9)
    assert.equal(seen[0]?.split(":")[2], "1")
    assert.equal(seen[8]?.split(":")[2], "9")
  })

  it("retries a failed live pin once", async () => {
    const points = [gridPoint("0:0", 0, 0)]
    let liveCalls = 0
    const client: MapsGridClient = {
      postTasks: async () => [],
      getTask: async () => null,
      liveAtCoordinate: async () => {
        liveCalls += 1
        if (liveCalls === 1) return { items: [], error: "Maps search timed out." }
        return { items: [mapsItem("Franklin Barbecue", "ChIJ-franklin", 3)], error: null }
      },
    }
    const cells = await scanMapsGrid(points, "barbecue", "login", "password", { client, pollTimeoutMs: 10, sleep: async () => {} })
    assert.equal(liveCalls, 2)
    assert.equal(cells[0]?.items.length, 1)
    assert.equal(cells[0]?.error, null)
  })
})

describe("collectPostedTasks", () => {
  it("uses the posted tag, not a missing response tag", async () => {
    const posted: PostedMapsTask[] = [{ id: "abc", tag: "2:1" }]
    const collected = await collectPostedTasks(
      posted,
      async () =>
        ({
          id: "abc",
          status_code: 20000,
          result: [{ items: [] }],
        }) satisfies MapsTaskSnapshot,
      50,
      async () => {},
    )
    assert.ok(collected.has("2:1"))
    assert.deepEqual(collected.get("2:1")?.items, [])
  })
})

describe("finalizeGridCells", () => {
  it("never leaves a grid point without a result row", () => {
    const points = buildGrid({ centerLat: 30.2701, centerLng: -97.7313, size: 3, spacingMiles: 1, zoom: 17 })
    const results = new Map()
    results.set(points[0]!.id, { point: points[0]!, items: [mapsItem("Franklin Barbecue", "x", 1)], error: null })
    const finalized = finalizeGridCells(points, results)
    assert.equal(finalized.length, 9)
    assert.equal(finalized.filter((row) => row.error).length, 8)
    assert.ok(finalized.every((row) => row.items != null))
  })
})
