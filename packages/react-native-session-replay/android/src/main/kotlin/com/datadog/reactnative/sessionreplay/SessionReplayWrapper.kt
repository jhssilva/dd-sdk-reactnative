/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

package com.datadog.reactnative.sessionreplay

import com.datadog.android.api.SdkCore
import com.datadog.android.sessionreplay.SessionReplayConfiguration

/**
 * Wrapper around [SessionReplay].
 */
interface SessionReplayWrapper {
    /**
     * Enables a SessionReplay feature based on the configuration provided.
     * @param sessionReplayConfiguration Configuration to use for the feature.
     */
    fun enable(
        sessionReplayConfiguration: SessionReplayConfiguration,
        sdkCore: SdkCore
    )

    /**
     * Manually start recording the current session.
     */
    fun startRecording(sdkCore: SdkCore)

    /**
     * Manually stop recording the current session.
     */
    fun stopRecording(sdkCore: SdkCore)
}
