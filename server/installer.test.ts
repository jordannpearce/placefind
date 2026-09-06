import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classifyInstaller } from "./installer.ts"

describe("classifyInstaller", () => {
  it("marks setup and portable Windows files", () => {
    assert.equal(classifyInstaller("PlaceFind-Setup-1.0.0.exe"), "setup")
    assert.equal(classifyInstaller("PlaceFind Setup 1.0.0.exe"), "setup")
    assert.equal(classifyInstaller("PlaceFind-Portable-1.0.0.exe"), "portable")
    assert.equal(classifyInstaller("notes.txt"), "other")
  })
})
