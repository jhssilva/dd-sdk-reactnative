/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

import Foundation
@_spi(Internal) import DatadogSessionReplay
import DatadogInternal
import DatadogSDKReactNative
import React

@objc
public class DdSessionReplayImplementation: NSObject {
    private lazy var sessionReplay: SessionReplayProtocol = sessionReplayProvider()
    private let sessionReplayProvider: () -> SessionReplayProtocol
    private let uiManager: RCTUIManager
    
    internal init(sessionReplayProvider: @escaping () -> SessionReplayProtocol, uiManager: RCTUIManager) {
        self.sessionReplayProvider = sessionReplayProvider
        self.uiManager = uiManager
    }

    @objc
    public convenience init(bridge: RCTBridge) {
        self.init(
            sessionReplayProvider: { NativeSessionReplay() },
            uiManager: bridge.uiManager
        )
    }

    @objc
    public func enable(
        replaySampleRate: Double,
        customEndpoint: String,
        imagePrivacyLevel: String,
        touchPrivacyLevel: String,
        textAndInputPrivacyLevel: String,
        startRecordingImmediately: Bool,
        resolve:RCTPromiseResolveBlock,
        reject:RCTPromiseRejectBlock
    ) -> Void {
        var customEndpointURL: URL? = nil
        if (customEndpoint != "") {
            customEndpointURL = URL(string: "\(customEndpoint)/api/v2/replay" as String)
        }
        var sessionReplayConfiguration = SessionReplay.Configuration(
            replaySampleRate: Float(replaySampleRate),
            imagePrivacyLevel: convertImagePrivacy(imagePrivacyLevel),
            touchPrivacyLevel: convertTouchPrivacy(touchPrivacyLevel),
            textAndInputPrivacyLevel: convertTextAndInputPrivacy(textAndInputPrivacyLevel),
            startRecordingImmediately: startRecordingImmediately,
            customEndpoint: customEndpointURL
        )
                    
        sessionReplayConfiguration.setAdditionalNodeRecorders([RCTTextViewRecorder(uiManager: self.uiManager)])

        if let core = DatadogSDKWrapper.shared.getCoreInstance() {
            sessionReplay.enable(
                with: sessionReplayConfiguration,
                in: core
            )
        } else {
            consolePrint("Core instance was not found when initializing Session Replay.", .critical)
        }

        resolve(nil)
    }
    
    @objc
    public func startRecording(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) -> Void {
        if let core = DatadogSDKWrapper.shared.getCoreInstance() {
            sessionReplay.startRecording(in: core)
        } else {
            consolePrint("Core instance was not found when calling startRecording in Session Replay.", .critical)
        }
        
        resolve(nil)
    }
    
    @objc
    public func stopRecording(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) -> Void {
        if let core = DatadogSDKWrapper.shared.getCoreInstance() {
            sessionReplay.stopRecording(in: core)
        } else {
            consolePrint("Core instance was not found when calling stopRecording in Session Replay.", .critical)
        }
        
        resolve(nil)
    }
    
    func convertImagePrivacy(_ imagePrivacy: NSString) -> ImagePrivacyLevel {
        switch imagePrivacy {
        case "MASK_NON_BUNDLED_ONLY":
            return .maskNonBundledOnly
        case "MASK_ALL":
            return .maskAll
        case "MASK_NONE":
            return .maskNone
        default:
            // TODO: Log wrong usage / mapping
            return .maskAll
        }
    }
    
    func convertTouchPrivacy(_ touchPrivacy: NSString) -> TouchPrivacyLevel {
        switch touchPrivacy {
        case "SHOW":
            return .show
        case "HIDE":
            return .hide
        default:
            // TODO: Log wrong usage / mapping
            return .hide
        }
    }
    
    func convertTextAndInputPrivacy(_ textAndInputPrivacy: NSString) -> TextAndInputPrivacyLevel {
        switch textAndInputPrivacy {
        case "MASK_SENSITIVE_INPUTS":
            return .maskSensitiveInputs
        case "MASK_ALL_INPUTS":
            return .maskAllInputs
        case "MASK_ALL":
            return .maskAll
        default:
            // TODO: Log wrong usage / mapping
            return .maskAll
        }
    }
}

internal protocol SessionReplayProtocol {
    func enable(
        with configuration: SessionReplay.Configuration,
        in core: DatadogCoreProtocol
    )
    
    func startRecording(in core: DatadogCoreProtocol)
    func stopRecording(in core: DatadogCoreProtocol)
}

internal class NativeSessionReplay: SessionReplayProtocol {
    func enable(with configuration: DatadogSessionReplay.SessionReplay.Configuration, in core: DatadogCoreProtocol) {
        SessionReplay.enable(with: configuration, in: core)
    }
    
    func startRecording(in core: any DatadogInternal.DatadogCoreProtocol) {
        SessionReplay.startRecording(in: core)
    }
    
    func stopRecording(in core: any DatadogInternal.DatadogCoreProtocol) {
        SessionReplay.stopRecording(in: core)
    }
}
