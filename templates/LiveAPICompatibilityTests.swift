// Copy to apps/ios/<App>Tests/LiveAPI/LiveAPICompatibilityTests.swift (playbook/14-shipping.md).
// Replace `API`, `TokenStore` and the calls with your app's own networking types: the point is that
// the test drives the exact code a shipped version runs, not a copy of it.
import Foundation
import Testing
@testable import App // your app module

/// Runs the app's own API code against a deployed Worker, so a server change that would break an
/// installed version fails on staging, before it reaches production.
///
/// CI copies today's version of this file into every app version still in use
/// (`git switch --detach ios/<version>-<build>`) and runs it against staging. Use only API the app
/// has had since the oldest version tested, or guard newer calls, so it still compiles there.
///
/// Skipped unless these are set (xcodebuild passes `TEST_RUNNER_<NAME>` as `<NAME>`):
/// - `LIVE_API_URL`: the Worker, e.g. https://api-staging.example.com
/// - `LIVE_PRO_USER_ID`, `LIVE_PRO_TOKEN`: an anonymous account that has Pro
///   (`.github/scripts/live-api-account.sh` makes one).
@MainActor
@Suite(.serialized, .enabled(if: LiveAPI.isConfigured, "Set LIVE_API_URL to run against a deployed API"))
struct LiveAPICompatibilityTests {
    @Test func serverIsUp() async throws {
        #expect(try await LiveAPI.client().health())
    }

    /// The first launch: anonymous sign-in, the free routes, and the paywall for the rest.
    @Test func newAnonymousAccountGetsFreeRoutesAndThePaywall() async throws {
        let api = LiveAPI.client()
        try await api.signInAnonymously()

        _ = try await api.freeFeature()                  // e.g. a catalog or onboarding route

        // A Pro route answers 402 (or whatever your app turns into the paywall).
        await #expect { try await api.proFeature() } throws: { error in
            (error as? APIError)?.status == 402
        }
        #expect(try await api.entitlements().isPro == false)

        // The app's own Delete account; also keeps staging free of test accounts.
        try await api.deleteAccount()
    }

    /// One call per feature a subscriber uses, through the same client types the screens use.
    @Test func proAccountUsesEveryFeature() async throws {
        let api = LiveAPI.client(token: try LiveAPI.proToken())
        #expect(try await api.entitlements().isPro)

        let result = try await api.proFeature()          // e.g. the core AI action, streamed
        #expect(!result.isEmpty)
        // …every other route the app calls: uploads, history, exports, POST /events.
    }
}

/// Where the live tests point and who they are, from the environment.
@MainActor
enum LiveAPI {
    nonisolated static var isConfigured: Bool { env["LIVE_API_URL"]?.isEmpty == false }
    nonisolated private static var env: [String: String] { ProcessInfo.processInfo.environment }

    /// Built the way the app builds its client, with the app's real headers (so the server sees
    /// the version under test), but with an in-memory token store instead of the Keychain.
    static func client(token: String? = nil) -> API {
        API(baseURL: URL(string: env["LIVE_API_URL"]!)!, tokens: InMemoryTokenStore(token: token))
    }

    static func proToken() throws -> String {
        try #require(env["LIVE_PRO_TOKEN"], "LIVE_PRO_TOKEN is not set")
    }
}

/// Keeps test accounts out of the simulator's Keychain.
final class InMemoryTokenStore: TokenStore, @unchecked Sendable {
    private let lock = NSLock()
    private var stored: String?
    init(token: String?) { stored = token }
    func load() -> String? { lock.withLock { stored } }
    func save(_ token: String) { lock.withLock { stored = token } }
    func delete() { lock.withLock { stored = nil } }
}
