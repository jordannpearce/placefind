import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import {
  approveUser,
  becomeBusiness,
  canLocalBootstrap,
  canManage,
  createManagedUser,
  createSession,
  deleteManagedUser,
  isLiveAppStore,
  isReservedSampleEmail,
  FORGOT_PASSWORD_MESSAGE,
  hashPassword,
  hashResetToken,
  impersonatingFromCookie,
  IMPERSONATE_COOKIE,
  issuePasswordReset,
  login,
  parseCookies,
  resetForgotRateLimitForTests,
  resetPasswordWithToken,
  SESSION_COOKIE,
  setUserStatus,
  signImpersonation,
  signup,
  signupIgnoringClientKind,
  startImpersonation,
  stopImpersonation,
  updateManagedUser,
  userFromCookie,
  verifyPassword,
} from "./auth.ts"
import { readCollection, reloadStoreFromDisk, resetStoreForTests, writeCollection } from "./store.ts"
import type { PasswordReset, User } from "./auth.ts"

describe("password hashing", () => {
  it("verifies a matching password and rejects a wrong one", () => {
    const stored = hashPassword("correct-horse")
    assert.equal(verifyPassword("correct-horse", stored), true)
    assert.equal(verifyPassword("wrong-horse", stored), false)
    assert.equal(stored.includes("correct-horse"), false)
  })
})

describe("parseCookies", () => {
  it("reads the PlaceFind session cookie", () => {
    const cookies = parseCookies("pf_session=abc123; other=1")
    assert.equal(cookies.pf_session, "abc123")
  })
})

describe("canManage", () => {
  function isolate() {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-auth-")))
  }

  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("does not treat seller or local-dev mode as admin for everyone", () => {
    isolate()
    const customer: User = {
      id: "cust1",
      name: "Casey",
      email: "casey@example.com",
      passwordHash: hashPassword("password12"),
      role: "customer",
      status: "active",
      createdAt: new Date().toISOString(),
    }
    writeCollection("users", [customer])
    writeCollection("sessions", [])
    assert.equal(canManage(undefined), false)
    assert.equal(canManage("pf_session=missing"), false)
    const token = createSession(customer.id)
    assert.equal(canManage(`pf_session=${token}`), false)
  })

  it("grants admin only for an admin session", () => {
    isolate()
    const admin: User = {
      id: "adm1",
      name: "Ada",
      email: "ada@example.com",
      passwordHash: hashPassword("password12"),
      role: "admin",
      status: "active",
      createdAt: new Date().toISOString(),
    }
    writeCollection("users", [admin])
    writeCollection("sessions", [])
    assert.equal(canManage(undefined), false)
    const token = createSession(admin.id)
    assert.equal(canManage(`pf_session=${token}`), true)
  })

  it("bootstraps the first local account as admin without opening admin to visitors", () => {
    isolate()
    assert.equal(canLocalBootstrap(), process.env.NODE_ENV !== "production")
    assert.equal(canManage(undefined), false)
    const created = signup({ name: "First Admin", email: "first@example.com", password: "password12" })
    assert.equal(created.user?.role, "admin")
    assert.equal(canManage(undefined), false)
    const token = createSession(created.user!.id)
    assert.equal(canManage(`pf_session=${token}`), true)
    assert.equal(canLocalBootstrap(), false)
  })
})

describe("account status", () => {
  function isolate() {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-auth-status-")))
  }

  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("blocks login for a suspended user", () => {
    isolate()
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const created = createManagedUser({
      name: "Sam",
      email: "sam@example.com",
      password: "password12",
      role: "customer",
    })
    assert.equal(created.user?.status, "active")
    const suspended = setUserStatus(created.user!.id, "suspended")
    assert.equal(suspended.error, undefined)
    assert.equal(suspended.user?.status, "suspended")
    const result = login({ email: "sam@example.com", password: "password12" })
    assert.equal(result.user, undefined)
    assert.equal(result.error, "This account is suspended.")
    const again = signup({ name: "Sam", email: "sam@example.com", password: "password12" })
    assert.equal(again.error, "This account is suspended.")
  })

  it("lets an admin change status and restores login after unsuspend", () => {
    isolate()
    const admin = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const customer = createManagedUser({
      name: "Casey",
      email: "casey@example.com",
      password: "password12",
      role: "customer",
    })
    assert.equal(customer.user?.status, "active")
    const token = createSession(admin.user!.id)
    assert.equal(canManage(`pf_session=${token}`), true)

    const suspended = setUserStatus(customer.user!.id, "suspended", admin.user!.id)
    assert.equal(suspended.user?.status, "suspended")
    assert.equal(login({ email: "casey@example.com", password: "password12" }).error, "This account is suspended.")
    assert.equal(userFromCookie(`pf_session=${createSession(customer.user!.id)}`), null)

    const active = setUserStatus(customer.user!.id, "active", admin.user!.id)
    assert.equal(active.user?.status, "active")
    const signedIn = login({ email: "casey@example.com", password: "password12" })
    assert.equal(signedIn.user?.email, "casey@example.com")
    assert.equal(signedIn.error, undefined)
  })
})

describe("password reset", () => {
  function isolate() {
    resetForgotRateLimitForTests()
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-auth-reset-")))
  }

  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    resetForgotRateLimitForTests()
    reloadStoreFromDisk()
  })

  it("returns a generic message whether or not the email exists", () => {
    isolate()
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const missing = issuePasswordReset("nobody@example.com")
    const found = issuePasswordReset("ada@example.com")
    const suspendedUser = createManagedUser({
      name: "Sam",
      email: "sam@example.com",
      password: "password12",
      role: "customer",
    })
    setUserStatus(suspendedUser.user!.id, "suspended")
    const suspended = issuePasswordReset("sam@example.com")
    assert.equal(missing.message, FORGOT_PASSWORD_MESSAGE)
    assert.equal(found.message, FORGOT_PASSWORD_MESSAGE)
    assert.equal(suspended.message, FORGOT_PASSWORD_MESSAGE)
    assert.equal(missing.rawToken, undefined)
    assert.equal(suspended.rawToken, undefined)
    assert.ok(found.rawToken)
    const stored = readCollection<PasswordReset>("password_resets")
    assert.equal(stored.some((row) => row.tokenHash === found.rawToken), false)
    assert.equal(stored.some((row) => row.tokenHash === hashResetToken(found.rawToken!)), true)
  })

  it("rejects an expired token and leaves the password unchanged", () => {
    isolate()
    const created = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    writeCollection("password_resets", [
      {
        tokenHash: hashResetToken("expired-token"),
        userId: created.user!.id,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        usedAt: null,
      },
    ])
    const result = resetPasswordWithToken({ token: "expired-token", password: "newpassword1" })
    assert.equal(result.user, undefined)
    assert.equal(result.error, "This reset link is invalid or has expired.")
    const stillOld = login({ email: "ada@example.com", password: "password12" })
    assert.equal(stillOld.user?.email, "ada@example.com")
    assert.equal(login({ email: "ada@example.com", password: "newpassword1" }).error, "Email or password is incorrect.")
  })

  it("changes the password for a valid token and rejects reuse", () => {
    isolate()
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const issued = issuePasswordReset("ada@example.com")
    assert.ok(issued.rawToken)
    const result = resetPasswordWithToken({ token: issued.rawToken!, password: "newpassword1" })
    assert.equal(result.error, undefined)
    assert.equal(result.user?.email, "ada@example.com")
    assert.equal(login({ email: "ada@example.com", password: "newpassword1" }).user?.email, "ada@example.com")
    assert.equal(login({ email: "ada@example.com", password: "password12" }).error, "Email or password is incorrect.")
    const reused = resetPasswordWithToken({ token: issued.rawToken!, password: "anotherpass1" })
    assert.equal(reused.user, undefined)
    assert.equal(reused.error, "This reset link is invalid or has expired.")
  })
})

describe("impersonation", () => {
  function isolate() {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-auth-impersonate-")))
  }

  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  function viewingCookie(sessionToken: string, impersonateToken: string) {
    return `${SESSION_COOKIE}=${sessionToken}; ${IMPERSONATE_COOKIE}=${impersonateToken}`
  }

  it("lets an admin view as a customer and stop to restore the admin", () => {
    isolate()
    const admin = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const customer = createManagedUser({
      name: "Casey",
      email: "casey@example.com",
      password: "password12",
      role: "customer",
    })
    const adminToken = createSession(admin.user!.id)
    const adminCookie = `${SESSION_COOKIE}=${adminToken}`
    const started = startImpersonation(adminCookie, customer.user!.id)
    assert.equal(started.error, undefined)
    assert.equal(started.user?.email, "casey@example.com")
    assert.deepEqual(started.impersonating, { name: "Casey", email: "casey@example.com" })
    assert.ok(started.token)

    const viewing = viewingCookie(adminToken, started.token!)
    assert.equal(userFromCookie(viewing)?.email, "casey@example.com")
    assert.equal(canManage(viewing), false)
    assert.deepEqual(impersonatingFromCookie(viewing), { name: "Casey", email: "casey@example.com" })
    assert.equal(canManage(adminCookie), true)

    const stopped = stopImpersonation(viewing)
    assert.equal(stopped.error, undefined)
    assert.equal(stopped.user?.email, "ada@example.com")
    assert.equal(stopped.user?.role, "admin")
    assert.equal(userFromCookie(adminCookie)?.email, "ada@example.com")
    assert.equal(canManage(adminCookie), true)
    assert.equal(impersonatingFromCookie(adminCookie), null)
  })

  it("rejects impersonation when the caller is not an admin", () => {
    isolate()
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const customer = createManagedUser({
      name: "Casey",
      email: "casey@example.com",
      password: "password12",
      role: "customer",
    })
    const other = createManagedUser({
      name: "Pat",
      email: "pat@example.com",
      password: "password12",
      role: "customer",
    })
    assert.equal(startImpersonation(undefined, customer.user!.id).error, "Admin access is required.")
    const customerCookie = `${SESSION_COOKIE}=${createSession(customer.user!.id)}`
    assert.equal(startImpersonation(customerCookie, other.user!.id).error, "Admin access is required.")
    assert.equal(canManage(customerCookie), false)
  })

  it("blocks viewing as another admin and still allows a suspended customer", () => {
    isolate()
    const admin = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const otherAdmin = createManagedUser({
      name: "Bea",
      email: "bea@example.com",
      password: "password12",
      role: "admin",
    })
    const customer = createManagedUser({
      name: "Sam",
      email: "sam@example.com",
      password: "password12",
      role: "customer",
    })
    setUserStatus(customer.user!.id, "suspended", admin.user!.id)
    const adminCookie = `${SESSION_COOKIE}=${createSession(admin.user!.id)}`
    assert.equal(startImpersonation(adminCookie, otherAdmin.user!.id).error, "You cannot view the app as another admin.")
    const started = startImpersonation(adminCookie, customer.user!.id)
    assert.equal(started.error, undefined)
    const viewing = viewingCookie(adminCookie.split("=")[1], started.token!)
    assert.equal(userFromCookie(viewing)?.email, "sam@example.com")
    assert.equal(userFromCookie(viewing)?.status, "suspended")
    assert.equal(canManage(viewing), false)
  })

  it("rejects a tampered or expired impersonation cookie", () => {
    isolate()
    const admin = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const customer = createManagedUser({
      name: "Casey",
      email: "casey@example.com",
      password: "password12",
      role: "customer",
    })
    const adminToken = createSession(admin.user!.id)
    const expired = signImpersonation({
      impersonatorId: admin.user!.id,
      userId: customer.user!.id,
      exp: Date.now() - 1000,
    })
    assert.equal(userFromCookie(viewingCookie(adminToken, `${expired}tampered`))?.email, "ada@example.com")
    assert.equal(canManage(viewingCookie(adminToken, expired)), true)
    assert.equal(impersonatingFromCookie(viewingCookie(adminToken, expired)), null)
    assert.equal(stopImpersonation(viewingCookie(adminToken, expired)).error, "You are not viewing as another user.")
  })
})

describe("admin account management", () => {
  function isolate() {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-auth-admin-")))
  }

  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("lets an admin create, edit, and delete another account", () => {
    isolate()
    const admin = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const created = createManagedUser({
      name: "Casey",
      email: "casey@example.com",
      password: "password12",
      role: "customer",
    })
    assert.equal(created.error, undefined)
    assert.equal(created.user?.email, "casey@example.com")
    assert.equal(created.user?.role, "customer")
    assert.equal(created.user?.status, "active")

    const renamed = updateManagedUser(
      created.user!.id,
      { name: "Casey Cole", email: "casey.cole@example.com", role: "customer" },
      admin.user!.id,
    )
    assert.equal(renamed.user?.name, "Casey Cole")
    assert.equal(renamed.user?.email, "casey.cole@example.com")

    const passworded = updateManagedUser(created.user!.id, { password: "newpassword1" }, admin.user!.id)
    assert.equal(passworded.error, undefined)
    assert.equal(login({ email: "casey.cole@example.com", password: "newpassword1" }).user?.name, "Casey Cole")

    const deleted = deleteManagedUser(created.user!.id, admin.user!.id)
    assert.equal(deleted.ok, true)
    assert.equal(login({ email: "casey.cole@example.com", password: "newpassword1" }).error, "Email or password is incorrect.")
  })

  it("blocks deleting or suspending the last admin, including self", () => {
    isolate()
    const admin = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    assert.equal(deleteManagedUser(admin.user!.id, admin.user!.id).error, "You cannot delete your own account.")
    assert.equal(setUserStatus(admin.user!.id, "suspended", admin.user!.id).error, "You cannot suspend your own account.")
    assert.equal(updateManagedUser(admin.user!.id, { role: "customer" }, admin.user!.id).error, "Keep at least one active admin.")
  })

  it("still allows reserved sample emails inside isolated test stores", () => {
    isolate()
    assert.equal(isLiveAppStore(), false)
    const created = signup({ name: "Casey", email: "casey-dir@example.com", password: "password12" })
    assert.equal(created.user?.email, "casey-dir@example.com")
    const managed = createManagedUser({
      name: "Jordan",
      email: "jordan-dir@example.test",
      password: "password12",
      role: "customer",
    })
    assert.equal(managed.user?.email, "jordan-dir@example.test")
  })

  it("refuses reserved sample emails in the live app store without writing them", () => {
    const previous = process.env.PLACEFIND_DATA_DIR
    try {
      process.env.PLACEFIND_DATA_DIR = path.resolve(process.cwd(), ".data")
      reloadStoreFromDisk()
      assert.equal(isLiveAppStore(), true)
      const before = new Set(readCollection<User>("users").map((user) => user.email))
      const signupEmail = `guard-signup-${Date.now()}@example.com`
      const managedEmail = `guard-managed-${Date.now()}@example.test`
      const created = signup({ name: "Walkthrough", email: signupEmail, password: "password12" })
      assert.equal(created.error, "Use a real email address.")
      const managed = createManagedUser({
        name: "Accounts Desk",
        email: managedEmail,
        password: "password12",
        role: "admin",
      })
      assert.equal(managed.error, "Use a real email address.")
      const after = readCollection<User>("users").map((user) => user.email)
      assert.equal(after.includes(signupEmail), false)
      assert.equal(after.includes(managedEmail), false)
      assert.deepEqual(new Set(after), before)
    } finally {
      if (previous == null) delete process.env.PLACEFIND_DATA_DIR
      else process.env.PLACEFIND_DATA_DIR = previous
    }
  })
})

describe("manual approval", () => {
  function isolate() {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-auth-approve-")))
  }

  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("keeps the first admin active and starts public signups as pending", () => {
    isolate()
    const admin = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    assert.equal(admin.user?.role, "admin")
    assert.equal(admin.user?.status, "active")
    const neighbor = signup({
      name: "Maya Chen",
      email: "maya@example.com",
      password: "password12",
      kind: "member",
    })
    const business = signup({ name: "Pat Owner", email: "pat@example.com", password: "password12" })
    assert.equal(neighbor.user?.status, "pending")
    assert.equal(neighbor.user?.accountKind, "member")
    assert.equal(business.user?.status, "pending")
    assert.equal(business.user?.accountKind, "business")
    const signedIn = login({ email: "maya@example.com", password: "password12" })
    assert.equal(signedIn.error, undefined)
    assert.equal(signedIn.user?.status, "pending")
    assert.equal(userFromCookie(`pf_session=${createSession(neighbor.user!.id)}`)?.status, "pending")
    const managed = createManagedUser({
      name: "Casey",
      email: "casey@example.com",
      password: "password12",
      role: "customer",
    })
    assert.equal(managed.user?.status, "active")
  })

  it("lets an admin approve a pending account", () => {
    isolate()
    const admin = signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const pending = signup({ name: "Sam", email: "sam@example.com", password: "password12", kind: "member" })
    assert.equal(pending.user?.status, "pending")
    const approved = approveUser(pending.user!.id, admin.user!.id)
    assert.equal(approved.error, undefined)
    assert.equal(approved.user?.status, "active")
    assert.equal(login({ email: "sam@example.com", password: "password12" }).user?.status, "active")
    const again = approveUser(pending.user!.id, admin.user!.id)
    assert.equal(again.user?.status, "active")
  })

  it("does not treat approve as unsuspend", () => {
    isolate()
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const customer = createManagedUser({
      name: "Sam",
      email: "sam@example.com",
      password: "password12",
      role: "customer",
    })
    setUserStatus(customer.user!.id, "suspended")
    const result = approveUser(customer.user!.id)
    assert.equal(result.user, undefined)
    assert.match(result.error ?? "", /unsuspend/i)
  })
})

describe("account kinds", () => {
  after(() => {
    delete process.env.PLACEFIND_DATA_DIR
    reloadStoreFromDisk()
  })

  it("signs up a free neighbor separately from a business listing account", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-kinds-")))
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const business = signup({ name: "Pat Owner", email: "pat@example.com", password: "password12" })
    const member = signup({
      name: "Maya Chen",
      email: "maya@example.com",
      password: "password12",
      kind: "member",
    })
    assert.equal(business.user?.accountKind, "business")
    assert.equal(member.user?.accountKind, "member")
    const upgraded = becomeBusiness(member.user!.id)
    assert.equal(upgraded.user?.accountKind, "business")
    assert.equal(upgraded.user?.status, "pending")
    assert.equal(upgraded.user?.status, "pending")
    const neighbor = createManagedUser({
      name: "Owen Blake",
      email: "owen@example.com",
      password: "password12",
      role: "customer",
      kind: "member",
    })
    assert.equal(neighbor.user?.accountKind, "member")
    const switched = becomeBusiness(neighbor.user!.id)
    assert.equal(switched.user?.accountKind, "business")
    assert.equal(switched.user?.status, "pending")
  })

  it("locks public Join and Create a Profile signups to the route kind", () => {
    resetStoreForTests(mkdtempSync(path.join(tmpdir(), "placefind-locked-kind-")))
    signup({ name: "Ada", email: "ada@example.com", password: "password12" })
    const spoofedBusiness = signupIgnoringClientKind(
      { name: "Maya Chen", email: "maya-lock@example.com", password: "password12", kind: "business" },
      "member",
    )
    const spoofedMember = signupIgnoringClientKind(
      { name: "Pat Owner", email: "pat-lock@example.com", password: "password12", kind: "member" },
      "business",
    )
    assert.equal(spoofedBusiness.user?.accountKind, "member")
    assert.equal(spoofedMember.user?.accountKind, "business")
  })
})

describe("reserved sample emails", () => {
  it("flags RFC example and test domains used by leftover walkthrough accounts", () => {
    assert.equal(isReservedSampleEmail("casey-dir@example.com"), true)
    assert.equal(isReservedSampleEmail("accounts.desk@example.test"), true)
    assert.equal(isReservedSampleEmail("buyer@example.com"), true)
    assert.equal(isReservedSampleEmail("tmrapp1995@gmail.com"), false)
    assert.equal(isReservedSampleEmail("hello@info.gridpins.com"), false)
  })
})
