/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2019-Present Datadog, Inc.
 */

import UIKit
@_spi(Internal)
import DatadogSessionReplay
import React

internal class RCTTextViewRecorder: SessionReplayNodeRecorder {
    internal var textObfuscator: (SessionReplayViewTreeRecordingContext) -> SessionReplayTextObfuscating = { context in
        return context.recorder.textAndInputPrivacy.staticTextObfuscator
    }

    internal var identifier = UUID()

    internal let uiManager: RCTUIManager

    internal init(uiManager: RCTUIManager) {
        self.uiManager = uiManager
    }

    internal func extractTextFromSubViews(
        subviews: [RCTShadowView]?
    ) -> String? {
        if let subviews = subviews {
            return subviews.compactMap { subview in
                if let sub = subview as? RCTRawTextShadowView {
                    return sub.text
                }
                if let sub = subview as? RCTVirtualTextShadowView {
                    // We recursively get all subviews for nested Text components
                    return extractTextFromSubViews(subviews: sub.reactSubviews())
                }
                return nil
            }.joined()
        }
        return nil
    }

    public func semantics(
        of view: UIView,
        with attributes: SessionReplayViewAttributes,
        in context: SessionReplayViewTreeRecordingContext
    ) -> SessionReplayNodeSemantics? {
        guard let textView = view as? RCTTextView else {
            return nil
        }

        var shadowView: RCTTextShadowView? = nil
        let tag = textView.reactTag

        RCTGetUIManagerQueue().sync {
            shadowView = uiManager.shadowView(forReactTag: tag) as? RCTTextShadowView
        }

        if let shadow = shadowView {
            // TODO: RUM-2173 check performance is ok
            let text = extractTextFromSubViews(
                subviews: shadow.reactSubviews()
            )

            let builder = RCTTextViewWireframesBuilder(
                wireframeID: context.ids.nodeID(view: textView, nodeRecorder: self),
                attributes: attributes,
                text: text,
                textAlignment: shadow.textAttributes.alignment,
                textColor: shadow.textAttributes.foregroundColor?.cgColor,
                textObfuscator: textObfuscator(context),
                fontSize: shadow.textAttributes.fontSize,
                contentRect: shadow.contentFrame
            )
            let node = SessionReplayNode(viewAttributes: attributes, wireframesBuilder: builder)
            return SessionReplaySpecificElement(subtreeStrategy: .ignore, nodes: [node])
        }
        return SessionReplayInvisibleElement.constant
    }
}

// Black color. This is the default for RN: https://github.com/facebook/react-native/blob/a5ee029cd02a636136058d82919480eeeb700067/packages/react-native/Libraries/Text/RCTTextAttributes.mm#L250
let DEFAULT_COLOR = UIColor.black.cgColor

// Default font size for RN: https://github.com/facebook/react-native/blob/16dff523b0a16d7fa9b651062c386885c2f48a6b/packages/react-native/React/Views/RCTFont.mm#L396
let DEFAULT_FONT_SIZE = CGFloat(14)

internal struct RCTTextViewWireframesBuilder: SessionReplayNodeWireframesBuilder {
    let wireframeID: WireframeID
    let attributes: SessionReplayViewAttributes
    let text: String?
    var textAlignment: NSTextAlignment
    let textColor: CGColor?
    let textObfuscator: SessionReplayTextObfuscating
    let fontSize: CGFloat
    let contentRect: CGRect

    public var wireframeRect: CGRect {
        attributes.frame
    }

    // Clipping should be 0 to avoid the text from overflowing when the
    // numberOfLines prop is used.
    // To apply clip(0 0 0 0) we set a negative clipping (which has no effect).
    // TODO: RUM-2354 remove this when clip(0 0 0 0) is applied 
    private var clip: SRContentClip {
        let top = -1.0 
        let left = 0.0
        let bottom = 0.0
        let right = 0.0
        return SRContentClip.create(
            bottom: Int64(withNoOverflow: bottom),
            left: Int64(withNoOverflow: left),
            right: Int64(withNoOverflow: right),
            top: Int64(withNoOverflow: top)
        )
    }

    private var relativeIntersectedRect: CGRect {
        return CGRect(
            x: attributes.frame.origin.x,
            y: attributes.frame.origin.y,
            width: max(contentRect.width, attributes.frame.width),
            height: max(contentRect.height, attributes.frame.height)
        )
    }

    private var textFrame: CGRect {
        return CGRect(
            x: attributes.frame.origin.x + contentRect.origin.x,
            y: attributes.frame.origin.y + contentRect.origin.y,
            width: contentRect.width,
            height: contentRect.height
        )
    }

    public func buildWireframes(with builder: SessionReplayWireframesBuilder) -> [SRWireframe] {
        return [
            builder.createTextWireframe(
                id: wireframeID,
                frame: relativeIntersectedRect,
                clip: attributes.clip,
                text: textObfuscator.mask(text: text ?? ""),
                textFrame: textFrame,
                // Text alignment is top for all RCTTextView components.
                textAlignment: .init(systemTextAlignment: textAlignment, vertical: .top),
                textColor: textColor ?? DEFAULT_COLOR,
                fontOverride: SessionReplayWireframesBuilder.FontOverride(size: fontSize.isNaN ? DEFAULT_FONT_SIZE : fontSize),
                borderColor: attributes.layerBorderColor,
                borderWidth: attributes.layerBorderWidth,
                backgroundColor: attributes.backgroundColor,
                cornerRadius: attributes.layerCornerRadius,
                opacity: attributes.alpha
            )
        ]
    }
}
