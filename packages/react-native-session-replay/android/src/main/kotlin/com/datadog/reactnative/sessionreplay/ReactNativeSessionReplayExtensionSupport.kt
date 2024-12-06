/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

package com.datadog.reactnative.sessionreplay

import androidx.annotation.VisibleForTesting
import com.datadog.android.api.InternalLogger
import com.datadog.android.sessionreplay.ExtensionSupport
import com.datadog.android.sessionreplay.MapperTypeWrapper
import com.datadog.android.sessionreplay.recorder.OptionSelectorDetector
import com.datadog.android.sessionreplay.utils.DrawableToColorMapper
import com.datadog.reactnative.sessionreplay.mappers.ReactEditTextMapper
import com.datadog.reactnative.sessionreplay.mappers.ReactNativeImageViewMapper
import com.datadog.reactnative.sessionreplay.mappers.ReactTextMapper
import com.datadog.reactnative.sessionreplay.mappers.ReactViewGroupMapper
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.UIManagerModule
import com.facebook.react.views.image.ReactImageView
import com.facebook.react.views.text.ReactTextView
import com.facebook.react.views.textinput.ReactEditText
import com.facebook.react.views.view.ReactViewGroup

internal class ReactNativeSessionReplayExtensionSupport(
    private val reactContext: ReactContext,
    private val logger: InternalLogger
) : ExtensionSupport {
    override fun name(): String {
        return ReactNativeSessionReplayExtensionSupport::class.java.simpleName
    }

    override fun getCustomViewMappers(): List<MapperTypeWrapper<*>> {
        val uiManagerModule = getUiManagerModule()

        return listOf(
            MapperTypeWrapper(ReactImageView::class.java, ReactNativeImageViewMapper()),
            MapperTypeWrapper(ReactViewGroup::class.java, ReactViewGroupMapper()),
            MapperTypeWrapper(ReactTextView::class.java, ReactTextMapper(reactContext, uiManagerModule)),
            MapperTypeWrapper(ReactEditText::class.java, ReactEditTextMapper(reactContext, uiManagerModule)),
        )
    }

    @VisibleForTesting
    internal fun getUiManagerModule(): UIManagerModule? {
        return try {
            reactContext.getNativeModule(UIManagerModule::class.java)
        } catch (e: IllegalStateException) {
            logger.log(
                level = InternalLogger.Level.WARN,
                targets = listOf(InternalLogger.Target.MAINTAINER, InternalLogger.Target.TELEMETRY),
                messageBuilder = { RESOLVE_UIMANAGERMODULE_ERROR },
                throwable = e
            )
            return null
        }
    }

    override fun getOptionSelectorDetectors(): List<OptionSelectorDetector> {
        return listOf()
    }

    override fun getCustomDrawableMapper(): List<DrawableToColorMapper> {
        return emptyList()
    }

    internal companion object {
        internal const val RESOLVE_UIMANAGERMODULE_ERROR = "Unable to resolve UIManagerModule"
    }
}
