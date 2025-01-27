/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

package com.datadog.reactnative.sessionreplay.extensions

import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.Bitmap.Config
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.ShapeDrawable
import android.graphics.drawable.VectorDrawable
import android.widget.ImageView
import androidx.appcompat.graphics.drawable.DrawerArrowDrawable
import com.facebook.drawee.drawable.ArrayDrawable
import com.facebook.drawee.drawable.ForwardingDrawable
import com.facebook.drawee.drawable.RoundedBitmapDrawable
import com.facebook.drawee.drawable.ScaleTypeDrawable
import com.facebook.drawee.drawable.ScalingUtils

internal fun ScaleTypeDrawable.imageViewScaleType(): ImageView.ScaleType? {
    return when (scaleType) {
        ScalingUtils.ScaleType.CENTER -> ImageView.ScaleType.CENTER
        ScalingUtils.ScaleType.CENTER_CROP -> ImageView.ScaleType.CENTER_CROP
        ScalingUtils.ScaleType.CENTER_INSIDE -> ImageView.ScaleType.CENTER_INSIDE
        ScalingUtils.ScaleType.FIT_CENTER -> ImageView.ScaleType.FIT_CENTER
        ScalingUtils.ScaleType.FIT_START -> ImageView.ScaleType.FIT_START
        ScalingUtils.ScaleType.FIT_END -> ImageView.ScaleType.FIT_END
        ScalingUtils.ScaleType.FIT_XY -> ImageView.ScaleType.FIT_XY
        else -> null
    }
}

internal fun ArrayDrawable.getScaleTypeDrawable(): ScaleTypeDrawable? {
    for (i in 0 until numberOfLayers) {
        val drawable = getDrawableOrNull(i)
        if (drawable is ScaleTypeDrawable) return drawable
    }

    return null
}

internal fun ArrayDrawable.getDrawableOrNull(index: Int): Drawable? {
    return try {
        getDrawable(index)
    } catch (_: IllegalArgumentException) {
        null
    }
}

internal fun ForwardingDrawable.tryToExtractBitmap(resources: Resources): Bitmap? {
    val forwardedDrawable = drawable
    return if (forwardedDrawable != null) {
        forwardedDrawable.tryToExtractBitmap(resources)
    } else {
       toBitmapOrNull(
            intrinsicWidth,
            intrinsicHeight,
            Config.ARGB_8888
        )
    }
}

internal fun RoundedBitmapDrawable.tryToExtractBitmap(): Bitmap? {
    val privateBitmap = try {
        val field = RoundedBitmapDrawable::class.java.getDeclaredField("mBitmap")
        field.isAccessible = true
        field.get(this) as? Bitmap
    } catch (_: NoSuchFieldException) {
        null
    } catch (_: IllegalAccessException) {
        null
    } catch (_: Exception) {
        null
    }

    return privateBitmap ?: toBitmapOrNull(
        intrinsicWidth,
        intrinsicHeight,
        Config.ARGB_8888
    )
}

internal fun BitmapDrawable.tryToExtractBitmap(resources: Resources): Bitmap? {
    if (bitmap != null) {
        return bitmap
    }

    if (constantState != null) {
        val copy = constantState?.newDrawable(resources)
        return (copy as? BitmapDrawable)?.bitmap ?: copy?.toBitmapOrNull(
            intrinsicWidth,
            intrinsicHeight,
            Config.ARGB_8888
        )
    }

    return null
}

internal fun ArrayDrawable.tryToExtractBitmap(resources: Resources): Bitmap? {
    var width = 0
    var height = 0
    for (index in 0 until numberOfLayers) {
        val drawable = getDrawableOrNull(index) ?: continue

        if (drawable is ScaleTypeDrawable) {
            return drawable.tryToExtractBitmap(resources)
        }

        if (drawable.intrinsicWidth * drawable.intrinsicHeight > width * height) {
            width = drawable.intrinsicWidth
            height = drawable.intrinsicHeight
        }
    }

    return if (width > 0 && height > 0)
        toBitmapOrNull(width, height, Config.ARGB_8888)
    else
        null
}

internal fun Drawable.tryToExtractBitmap(
    resources: Resources
): Bitmap? {
    when (this) {
        is ArrayDrawable -> {
            return tryToExtractBitmap(resources)
        }
        is ForwardingDrawable -> {
            return tryToExtractBitmap(resources)
        }
        is RoundedBitmapDrawable -> {
            return tryToExtractBitmap()
        }
        is BitmapDrawable -> {
            return tryToExtractBitmap(resources)
        }
        is VectorDrawable, is ShapeDrawable, is DrawerArrowDrawable -> {
            return toBitmapOrNull(
                intrinsicWidth,
                intrinsicHeight,
                Config.ARGB_8888
            )
        }
        else -> return null
    }
}

internal fun Drawable.toBitmapOrNull(
    width: Int = intrinsicWidth,
    height: Int = intrinsicHeight,
    config: Config? = null
): Bitmap? {
    if (this is BitmapDrawable && bitmap == null) {
        return null
    }
    return toBitmap(width, height, config)
}

internal fun Drawable.toBitmap(
    width: Int = intrinsicWidth,
    height: Int = intrinsicHeight,
    config: Config? = null
): Bitmap {
    if (this is BitmapDrawable) {
        if (bitmap == null) {
            return Bitmap.createBitmap(width, height, config ?: Config.ARGB_8888)
        }
        if (config == null || bitmap.config == config) {
            // Fast-path to return original. Bitmap.createScaledBitmap will do this check, but it
            // involves allocation and two jumps into native code so we perform the check ourselves.
            if (width == bitmap.width && height == bitmap.height) {
                return bitmap
            }
            return Bitmap.createScaledBitmap(bitmap, width, height, true)
        }
    }

    val bitmap = Bitmap.createBitmap(width, height, config ?: Config.ARGB_8888)
    setBounds(0, 0, width, height)
    draw(Canvas(bitmap))

    setBounds(bounds.left, bounds.top, bounds.right, bounds.bottom)
    return bitmap
}
