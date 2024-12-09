/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

package com.datadog.reactnative.sessionreplay.utils

import android.graphics.drawable.Drawable
import com.datadog.android.sessionreplay.model.MobileSegment

internal abstract class DrawableUtils(
    protected val reflectionUtils: ReflectionUtils = ReflectionUtils()
) {
    internal abstract fun resolveShapeAndBorder(
        drawable: Drawable,
        opacity: Float,
        pixelDensity: Float
    ): Pair<MobileSegment.ShapeStyle?, MobileSegment.ShapeBorder?>

    internal abstract fun getReactBackgroundFromDrawable(drawable: Drawable?): Drawable?
}
