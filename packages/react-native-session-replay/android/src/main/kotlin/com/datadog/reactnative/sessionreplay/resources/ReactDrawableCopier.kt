/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

package com.datadog.reactnative.sessionreplay.resources

import android.content.res.Resources
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import com.datadog.android.sessionreplay.recorder.resources.DefaultDrawableCopier
import com.datadog.android.sessionreplay.recorder.resources.DrawableCopier
import com.datadog.reactnative.sessionreplay.extensions.tryToExtractBitmap

internal class ReactDrawableCopier : DrawableCopier {
    private val defaultCopier = DefaultDrawableCopier()

    override fun copy(
        originalDrawable: Drawable,
        resources: Resources
    ): Drawable? {
        return if (originalDrawable.constantState != null) {
            defaultCopier.copy(originalDrawable, resources)
        } else {
            originalDrawable.tryToExtractBitmap(resources)?.let { bitmap ->
                BitmapDrawable(resources, bitmap).apply {
                    bounds = originalDrawable.bounds
                    alpha = originalDrawable.alpha
                }
            }
        }
    }
}
