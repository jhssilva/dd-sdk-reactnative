/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

package com.datadog.reactnative.sessionreplay

import com.datadog.android.api.feature.FeatureSdkCore
import com.datadog.android.sessionreplay.ImagePrivacy
import com.datadog.android.sessionreplay.SessionReplayConfiguration
import com.datadog.android.sessionreplay.TextAndInputPrivacy
import com.datadog.android.sessionreplay.TouchPrivacy
import com.datadog.reactnative.DatadogSDKWrapperStorage
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactContext
import java.util.Locale

/**
 * The entry point to use Datadog's Session Replay feature.
 */
class DdSessionReplayImplementation(
    private val reactContext: ReactContext,
    private val sessionReplayProvider: () -> SessionReplayWrapper = {
        SessionReplaySDKWrapper()
    }
) {
    /**
     * Enable session replay and start recording session.
     * @param replaySampleRate The sample rate applied for session replay.
     * @param customEndpoint Custom server url for sending replay data.
     * @param imagePrivacyLevel Defines the way images should be masked.
     * @param touchPrivacyLevel Defines the way user touches should be masked.
     * @param textAndInputPrivacyLevel Defines the way text and input should be masked.
     * @param startRecordingImmediately Whether the recording should start immediately when the feature is enabled.
     */
    fun enable(
        replaySampleRate: Double,
        customEndpoint: String,
        imagePrivacyLevel: String,
        touchPrivacyLevel: String,
        textAndInputPrivacyLevel: String,
        startRecordingImmediately: Boolean,
        promise: Promise
    ) {
        val sdkCore = DatadogSDKWrapperStorage.getSdkCore() as FeatureSdkCore
        val logger = sdkCore.internalLogger
        val configuration = SessionReplayConfiguration.Builder(replaySampleRate.toFloat())
            .startRecordingImmediately(startRecordingImmediately)
            .setImagePrivacy(convertImagePrivacyLevel(imagePrivacyLevel))
            .setTouchPrivacy(convertTouchPrivacyLevel(touchPrivacyLevel))
            .setTextAndInputPrivacy(convertTextAndInputPrivacyLevel(textAndInputPrivacyLevel))
            .addExtensionSupport(ReactNativeSessionReplayExtensionSupport(reactContext, logger))

        if (customEndpoint != "") {
            configuration.useCustomEndpoint(customEndpoint)
        }

        sessionReplayProvider().enable(configuration.build(), sdkCore)
        promise.resolve(null)
    }

    /**
     * Manually start recording the current session.
     */
    fun startRecording(promise: Promise) {
        sessionReplayProvider().startRecording(
            DatadogSDKWrapperStorage.getSdkCore() as FeatureSdkCore
        )
        promise.resolve(null)
    }

    /**
     * Manually stop recording the current session.
     */
    fun stopRecording(promise: Promise) {
        sessionReplayProvider().stopRecording(
            DatadogSDKWrapperStorage.getSdkCore() as FeatureSdkCore
        )
        promise.resolve(null)
    }

    @Deprecated("Privacy should be set with separate properties mapped to " +
            "`setImagePrivacy`, `setTouchPrivacy`, `setTextAndInputPrivacy`, but they are" +
            " currently unavailable.")
    private fun SessionReplayConfiguration.Builder.configurePrivacy(
        defaultPrivacyLevel: String
    ): SessionReplayConfiguration.Builder {
        when (defaultPrivacyLevel.lowercase(Locale.US)) {
            "mask" -> {
                this.setTextAndInputPrivacy(TextAndInputPrivacy.MASK_ALL)
                this.setImagePrivacy(ImagePrivacy.MASK_ALL)
                this.setTouchPrivacy(TouchPrivacy.HIDE)
            }
            "mask_user_input" -> {
                this.setTextAndInputPrivacy(TextAndInputPrivacy.MASK_ALL_INPUTS)
                this.setImagePrivacy(ImagePrivacy.MASK_NONE)
                this.setTouchPrivacy(TouchPrivacy.HIDE)
            }
            "allow" -> {
                this.setTextAndInputPrivacy(TextAndInputPrivacy.MASK_SENSITIVE_INPUTS)
                this.setImagePrivacy(ImagePrivacy.MASK_NONE)
                this.setTouchPrivacy(TouchPrivacy.SHOW)
            }
        }
        return this
    }

    companion object {
        internal const val NAME = "DdSessionReplay"

        internal fun convertImagePrivacyLevel(imagePrivacyLevel: String): ImagePrivacy {
            return when (imagePrivacyLevel) {
                "MASK_NON_BUNDLED_ONLY" -> ImagePrivacy.MASK_LARGE_ONLY
                "MASK_ALL" -> ImagePrivacy.MASK_ALL
                "MASK_NONE" -> ImagePrivacy.MASK_NONE
                else -> {
                    // TODO: Log wrong usage / mapping.
                    ImagePrivacy.MASK_ALL
                }
            }
        }

        internal fun convertTouchPrivacyLevel(touchPrivacyLevel: String): TouchPrivacy {
            return when (touchPrivacyLevel) {
                "SHOW" -> TouchPrivacy.SHOW
                "HIDE" -> TouchPrivacy.HIDE
                else -> {
                    // TODO: Log wrong usage / mapping.
                    TouchPrivacy.HIDE
                }
            }
        }

        internal fun convertTextAndInputPrivacyLevel(textAndInputPrivacyLevel: String): TextAndInputPrivacy {
            return when (textAndInputPrivacyLevel) {
                "MASK_SENSITIVE_INPUTS" -> TextAndInputPrivacy.MASK_SENSITIVE_INPUTS
                "MASK_ALL_INPUTS" -> TextAndInputPrivacy.MASK_ALL_INPUTS
                "MASK_ALL" -> TextAndInputPrivacy.MASK_ALL
                else -> {
                    // TODO: Log wrong usage / mapping
                    TextAndInputPrivacy.MASK_ALL
                }
            }
        }
    }
}
