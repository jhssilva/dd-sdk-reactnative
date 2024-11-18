/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

package com.datadog.reactnative.sessionreplay

import com.datadog.android.sessionreplay.ImagePrivacy
import com.datadog.android.sessionreplay.TextAndInputPrivacy
import com.datadog.android.sessionreplay.TouchPrivacy

/**
 * A utility class to store Session Replay privacy settings, and convert them from string to
 * enum values.
 *
 * @param imagePrivacyLevel Defines the way images should be masked.
 * @param touchPrivacyLevel Defines the way user touches should be masked.
 * @param textAndInputPrivacyLevel Defines the way text and input should be masked.
 */
class SessionReplayPrivacySettings(
    imagePrivacyLevel: String,
    touchPrivacyLevel: String,
    textAndInputPrivacyLevel: String
){
    /**
     * Defines the way images should be masked.
     */
    val imagePrivacyLevel = getImagePrivacy(imagePrivacyLevel)

    /**
     * Defines the way user touches should be masked.
     */
    val touchPrivacyLevel = getTouchPrivacy(touchPrivacyLevel)

    /**
     * Defines the way text and input should be masked.
     */
    val textAndInputPrivacyLevel = getTextAndInputPrivacy(textAndInputPrivacyLevel)

    companion object {
        internal fun getImagePrivacy(imagePrivacyLevel: String): ImagePrivacy {
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

        internal fun getTouchPrivacy(touchPrivacyLevel: String): TouchPrivacy {
            return when (touchPrivacyLevel) {
                "SHOW" -> TouchPrivacy.SHOW
                "HIDE" -> TouchPrivacy.HIDE
                else -> {
                    // TODO: Log wrong usage / mapping.
                    TouchPrivacy.HIDE
                }
            }
        }

        internal fun getTextAndInputPrivacy(textAndInputPrivacyLevel: String): TextAndInputPrivacy {
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