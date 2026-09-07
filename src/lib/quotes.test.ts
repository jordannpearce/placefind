import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatQuoteAddress, validateQuoteLead } from "./quotes.ts"

const completeLead = {
  firstName: "Maya",
  lastName: "Chen",
  email: "Maya@Example.com",
  phone: "(207) 555-0100",
  street: "18 Harbor Lane",
  city: "Portland",
  state: "ME",
  zip: "04101",
  service: "HVAC",
}

describe("quote leads", () => {
  it("requires first name, last name, phone, email, address, and a service", () => {
    assert.equal(validateQuoteLead({ ...completeLead, firstName: "" }).error, "Enter your first name.")
    assert.equal(validateQuoteLead({ ...completeLead, lastName: "" }).error, "Enter your last name.")
    assert.equal(
      validateQuoteLead({ ...completeLead, email: "not-an-email" }).error,
      "Enter an email so the business can write you back.",
    )
    assert.equal(validateQuoteLead({ ...completeLead, phone: "555-01" }).error, "Enter a phone number.")
    assert.equal(validateQuoteLead({ ...completeLead, street: "12" }).error, "Enter your street address.")
    assert.equal(validateQuoteLead({ ...completeLead, city: "" }).error, "Enter your city.")
    assert.equal(validateQuoteLead({ ...completeLead, state: "ZZ" }).error, "Choose a state.")
    assert.equal(validateQuoteLead({ ...completeLead, zip: "4101" }).error, "Enter a ZIP code.")
    assert.equal(validateQuoteLead({ ...completeLead, service: "" }).error, "Enter the service you need.")
    assert.equal(
      validateQuoteLead({ ...completeLead, service: "x".repeat(2001) }).error,
      "Keep the request under 2,000 characters.",
    )
  })

  it("accepts a short service, ZIP+4, and a full state name", () => {
    const parsed = validateQuoteLead({
      firstName: "Maya",
      lastName: "Chen",
      email: "Maya@Example.com",
      phone: "(207) 555-0100",
      street: "18 Harbor Lane",
      city: "Portland",
      state: "Maine",
      zip: "04101-1234",
      service: "HVAC",
    })
    assert.deepEqual(parsed.value, {
      firstName: "Maya",
      lastName: "Chen",
      name: "Maya Chen",
      email: "maya@example.com",
      phone: "(207) 555-0100",
      street: "18 Harbor Lane",
      city: "Portland",
      state: "ME",
      zip: "04101-1234",
      service: "HVAC",
    })
    assert.equal(formatQuoteAddress(parsed.value!), "18 Harbor Lane, Portland, ME 04101-1234")
  })

  it("accepts a legacy name and need field", () => {
    const parsed = validateQuoteLead({
      name: "Maya Chen",
      email: "maya@example.com",
      phone: "2075550100",
      street: "18 Harbor Lane",
      city: "Portland",
      state: "ME",
      zip: "04101",
      need: "Two dozen sandwich loaves for a Friday office lunch.",
    })
    assert.equal(parsed.value?.firstName, "Maya")
    assert.equal(parsed.value?.lastName, "Chen")
    assert.equal(parsed.value?.name, "Maya Chen")
    assert.equal(parsed.value?.service, "Two dozen sandwich loaves for a Friday office lunch.")
  })
})
