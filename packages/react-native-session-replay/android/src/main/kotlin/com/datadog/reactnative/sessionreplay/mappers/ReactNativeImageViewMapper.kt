/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

package com.datadog.reactnative.sessionreplay.mappers

import android.graphics.Rect
import com.datadog.android.api.InternalLogger
import com.datadog.android.internal.utils.ImageViewUtils
import com.datadog.android.internal.utils.densityNormalized
import com.datadog.android.sessionreplay.model.MobileSegment
import com.datadog.android.sessionreplay.recorder.MappingContext
import com.datadog.android.sessionreplay.recorder.mapper.BaseAsyncBackgroundWireframeMapper
import com.datadog.android.sessionreplay.utils.AsyncJobStatusCallback
import com.datadog.android.sessionreplay.utils.DefaultColorStringFormatter
import com.datadog.android.sessionreplay.utils.DefaultViewBoundsResolver
import com.datadog.android.sessionreplay.utils.DefaultViewIdentifierResolver
import com.datadog.android.sessionreplay.utils.DrawableToColorMapper
import com.datadog.reactnative.sessionreplay.extensions.getScaleTypeDrawable
import com.datadog.reactnative.sessionreplay.extensions.imageViewScaleType
import com.datadog.reactnative.sessionreplay.resources.ReactDrawableCopier
import com.facebook.drawee.drawable.FadeDrawable
import com.facebook.react.views.image.ReactImageView

internal class ReactNativeImageViewMapper: BaseAsyncBackgroundWireframeMapper<ReactImageView>(
    viewIdentifierResolver = DefaultViewIdentifierResolver,
    colorStringFormatter = DefaultColorStringFormatter,
    viewBoundsResolver = DefaultViewBoundsResolver,
    drawableToColorMapper = DrawableToColorMapper.getDefault()
) {
    private val drawableCopier = ReactDrawableCopier()

    override fun map(
        view: ReactImageView,
        mappingContext: MappingContext,
        asyncJobStatusCallback: AsyncJobStatusCallback,
        internalLogger: InternalLogger
    ): List<MobileSegment.Wireframe> {
        val wireframes = mutableListOf<MobileSegment.Wireframe>()
        wireframes.addAll(super.map(view, mappingContext, asyncJobStatusCallback, internalLogger))

        val drawable = view.drawable?.current ?: return wireframes

        val parentRect = ImageViewUtils.resolveParentRectAbsPosition(view)
        val scaleType = (drawable as? FadeDrawable)
            ?.getScaleTypeDrawable()
            ?.imageViewScaleType() ?: view.scaleType
        val contentRect = ImageViewUtils.resolveContentRectWithScaling(view, drawable, scaleType)

        val resources = view.resources
        val density = resources.displayMetrics.density

        val clipping = if (view.cropToPadding) {
            ImageViewUtils.calculateClipping(parentRect, contentRect, density)
        } else {
            null
        }

        val contentXPosInDp = contentRect.left.densityNormalized(density).toLong()
        val contentYPosInDp = contentRect.top.densityNormalized(density).toLong()
        val contentWidthPx = contentRect.width()
        val contentHeightPx = contentRect.height()

        // resolve foreground
        mappingContext.imageWireframeHelper.createImageWireframeByDrawable(
            view = view,
            imagePrivacy = mappingContext.imagePrivacy,
            currentWireframeIndex = wireframes.size,
            x = contentXPosInDp,
            y = contentYPosInDp,
            width = contentWidthPx,
            height = contentHeightPx,
            usePIIPlaceholder = true,
            drawable = drawable,
            drawableCopier = drawableCopier,
            asyncJobStatusCallback = asyncJobStatusCallback,
            clipping = clipping?.toWireframeClip(),
            shapeStyle = null,
            border = null,
            prefix = "drawable",
            customResourceIdCacheKey = generateUUID(view)
        )?.let {
            wireframes.add(it)
        }

        return wireframes
    }

    private fun generateUUID(reactImageView: ReactImageView): String {
        val hashCode = System.identityHashCode(reactImageView).toString()
        val drawableType = reactImageView.drawable.current::class.java.name
        return "${drawableType}-${hashCode}"
    }

    private fun Rect.toWireframeClip(): MobileSegment.WireframeClip {
        return MobileSegment.WireframeClip(
            top = top.toLong(),
            bottom = bottom.toLong(),
            left = left.toLong(),
            right = right.toLong()
        )
    }
}

