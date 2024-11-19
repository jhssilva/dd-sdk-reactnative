/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2019-2020 Datadog, Inc.
 */

import XCTest
@testable import DatadogSDKReactNativeSessionReplay
import DatadogSessionReplay
import DatadogSDKReactNative
import DatadogInternal
import React

internal class DdSessionReplayTests: XCTestCase {
    private func mockResolve(args: Any?) {}
    private func mockReject(args: String?, arg: String?, err: Error?) {}
    
    override func setUp() {
        super.setUp()
        let mockDatadogCore = MockDatadogCore()
        DatadogSDKWrapper.shared.setCoreInstance(core: mockDatadogCore)
    }
 
    func testEnablesSessionReplayWithZeroReplaySampleRate() {
        let sessionReplayMock = MockSessionReplay()
        let uiManagerMock = MockUIManager()
        DdSessionReplayImplementation(sessionReplayProvider:{ sessionReplayMock }, uiManager: uiManagerMock)
            .enable(replaySampleRate: 0, defaultPrivacyLevel: "MASK", customEndpoint: "", startRecordingImmediately: true, resolve: mockResolve, reject: mockReject)

        XCTAssertEqual(sessionReplayMock.calledMethods.first, .enable(
            replaySampleRate: 0.0,
            privacyLevel: .mask,
            customEndpoint: nil,
            startRecordingImmediately: true
        ))
    }
    
    func testEnablesSessionReplayWithMaskPrivacyLevel() {
        let sessionReplayMock = MockSessionReplay()
        let uiManagerMock = MockUIManager()
        DdSessionReplayImplementation(sessionReplayProvider:{ sessionReplayMock }, uiManager: uiManagerMock).enable(
            replaySampleRate: 100,
            defaultPrivacyLevel: "MASK",
            customEndpoint: "",
            startRecordingImmediately: true,
            resolve: mockResolve,
            reject: mockReject
        )
        
        XCTAssertEqual(sessionReplayMock.calledMethods.first, .enable(
            replaySampleRate: 100.0,
            privacyLevel: .mask,
            customEndpoint: nil,
            startRecordingImmediately: true
        ))
    }
    
    func testEnablesSessionReplayWithMaskUserInputPrivacyLevel() {
        let sessionReplayMock = MockSessionReplay()
        let uiManagerMock = MockUIManager()
        DdSessionReplayImplementation(sessionReplayProvider:{ sessionReplayMock }, uiManager: uiManagerMock).enable(
            replaySampleRate: 100,
            defaultPrivacyLevel: "MASK_USER_INPUT",
            customEndpoint: "",
            startRecordingImmediately: true,
            resolve: mockResolve,
            reject: mockReject
        )
        
        XCTAssertEqual(sessionReplayMock.calledMethods.first, .enable(
            replaySampleRate: 100.0,
            privacyLevel: .maskUserInput,
            customEndpoint: nil,
            startRecordingImmediately: true
        ))
    }
    
    func testEnablesSessionReplayWithAllowPrivacyLevel() {
        let sessionReplayMock = MockSessionReplay()
        let uiManagerMock = MockUIManager()
        DdSessionReplayImplementation(sessionReplayProvider:{ sessionReplayMock }, uiManager: uiManagerMock).enable(
            replaySampleRate: 100,
            defaultPrivacyLevel: "ALLOW",
            customEndpoint: "",
            startRecordingImmediately: true,
            resolve: mockResolve,
            reject: mockReject
        )
        
        XCTAssertEqual(sessionReplayMock.calledMethods.first, .enable(
            replaySampleRate: 100.0,
            privacyLevel: .allow,
            customEndpoint: nil,
            startRecordingImmediately: true
        ))
    }
    
    func testEnablesSessionReplayWithBadPrivacyLevel() {
        let sessionReplayMock = MockSessionReplay()
        let uiManagerMock = MockUIManager()
        DdSessionReplayImplementation(sessionReplayProvider:{ sessionReplayMock }, uiManager: uiManagerMock).enable(
            replaySampleRate: 100,
            defaultPrivacyLevel: "BAD_VALUE",
            customEndpoint: "",
            startRecordingImmediately: true,
            resolve: mockResolve,
            reject: mockReject
        )
        
        XCTAssertEqual(sessionReplayMock.calledMethods.first, .enable(
            replaySampleRate: 100.0,
            privacyLevel: .mask,
            customEndpoint: nil,
            startRecordingImmediately: true
        ))
    }
    
    func testEnablesSessionReplayWithCustomEndpoint() {
        let sessionReplayMock = MockSessionReplay()
        let uiManagerMock = MockUIManager()
        DdSessionReplayImplementation(sessionReplayProvider:{ sessionReplayMock }, uiManager: uiManagerMock).enable(
            replaySampleRate: 100,
            defaultPrivacyLevel: "MASK",
            customEndpoint: "https://session-replay.example.com",
            startRecordingImmediately: true,
            resolve: mockResolve,
            reject: mockReject)
        
        XCTAssertEqual(sessionReplayMock.calledMethods.first, .enable(
            replaySampleRate: 100.0,
            privacyLevel: .mask,
            customEndpoint: URL(string: "https://session-replay.example.com/api/v2/replay"),
            startRecordingImmediately: true
        ))
    }
    
    func testStartSessionReplayManually() {
        let sessionReplayMock = MockSessionReplay()
        let uiManagerMock = MockUIManager()
        let sessionReplay = DdSessionReplayImplementation(sessionReplayProvider:{ sessionReplayMock }, uiManager: uiManagerMock)
        sessionReplay.enable(
            replaySampleRate: 100,
            defaultPrivacyLevel: "MASK",
            customEndpoint: "https://session-replay.example.com",
            startRecordingImmediately: true,
            resolve: mockResolve,
            reject: mockReject
        )
        
        sessionReplay.startRecording(resolve: mockResolve, reject: mockReject)
        
        XCTAssertEqual(sessionReplayMock.calledMethods.last, .startRecording)
    }
    
    func testStopSessionReplayManually() {
        let sessionReplayMock = MockSessionReplay()
        let uiManagerMock = MockUIManager()
        let sessionReplay = DdSessionReplayImplementation(sessionReplayProvider:{ sessionReplayMock }, uiManager: uiManagerMock)
        sessionReplay.enable(
            replaySampleRate: 100,
            defaultPrivacyLevel: "MASK",
            customEndpoint: "https://session-replay.example.com",
            startRecordingImmediately: true,
            resolve: mockResolve,
            reject: mockReject
        )
        
        sessionReplay.stopRecording(resolve: mockResolve, reject: mockReject)
        
        XCTAssertEqual(sessionReplayMock.calledMethods.last, .stopRecording)
    }
}

private class MockSessionReplay: SessionReplayProtocol {
    enum CalledMethod: Equatable {
        case enable(
            replaySampleRate: Float,
            privacyLevel: SessionReplayPrivacyLevel,
            customEndpoint: URL?,
            startRecordingImmediately: Bool
        )
        case startRecording
        case stopRecording
    }

    public var calledMethods = [CalledMethod]()

    func enable(with configuration: SessionReplay.Configuration, in core: DatadogCoreProtocol) {
        calledMethods.append(
            .enable(
                replaySampleRate: configuration.replaySampleRate,
                privacyLevel: configuration.defaultPrivacyLevel,
                customEndpoint: configuration.customEndpoint,
                startRecordingImmediately: configuration.startRecordingImmediately
            )
        )
    }
    
    func startRecording(in core: any DatadogInternal.DatadogCoreProtocol) {
        calledMethods.append(.startRecording)
    }
    
    func stopRecording(in core: any DatadogInternal.DatadogCoreProtocol) {
        calledMethods.append(.stopRecording)
    }
}

private class MockUIManager: RCTUIManager {}

private class MockDatadogCore: DatadogCoreProtocol {
    func mostRecentModifiedFileAt(before: Date) throws -> Date? {
        return nil
    }
    
    func scope<T>(for featureType: T.Type) -> any DatadogInternal.FeatureScope where T : DatadogInternal.DatadogFeature {
        return NOPFeatureScope()
    }
    
    func feature<T>(named name: String, type: T.Type) -> T? {
        return nil
    }

    func register<T>(feature: T) throws where T : DatadogInternal.DatadogFeature {}
    func send(message: DatadogInternal.FeatureMessage, else fallback: @escaping () -> Void) {}
    func set(baggage: @escaping () -> DatadogInternal.FeatureBaggage?, forKey key: String) {}
}
