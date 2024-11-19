/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

package com.datadog.reactnative.sessionreplay

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod

/**
 * The entry point to use Datadog's Session Replay feature.
 */
class DdSessionReplay(
    reactContext: ReactApplicationContext
) : NativeDdSessionReplaySpec(reactContext) {

    private val implementation = DdSessionReplayImplementation(reactContext)

    override fun getName(): String = DdSessionReplayImplementation.NAME
    
    /**
     * Enable session replay and start recording session.
     * @param replaySampleRate The sample rate applied for session replay.
     * @param defaultPrivacyLevel The privacy level used for replay.
     * @param customEndpoint Custom server url for sending replay data.
     * @param imagePrivacyLevel Defines the way images should be masked.
     * @param touchPrivacyLevel Defines the way user touches should be masked.
     * @param textAndInputPrivacyLevel Defines the way text and input should be masked.
     */
    @ReactMethod
    override fun enable(
        replaySampleRate: Double,
        customEndpoint: String,
        imagePrivacyLevel: String,
        touchPrivacyLevel: String,
        textAndInputPrivacyLevel: String,
        promise: Promise
    ) {
        implementation.enable(
            replaySampleRate,
            customEndpoint,
            SessionReplayPrivacySettings(
                imagePrivacyLevel = imagePrivacyLevel,
                touchPrivacyLevel = touchPrivacyLevel,
                textAndInputPrivacyLevel = textAndInputPrivacyLevel
            ),
            promise
        )
    }
}
