/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

import { version as reactNativeVersion } from 'react-native/package.json';
import { InteractionManager } from 'react-native';

import {
    DdSdkReactNativeConfiguration,
    buildConfigurationFromPartialConfiguration,
    addDefaultValuesToAutoInstrumentationConfiguration,
    InitializationMode,
    formatFirstPartyHosts
} from './DdSdkReactNativeConfiguration';
import type {
    AutoInstrumentationParameters,
    DatadogProviderConfiguration,
    PartialInitializationConfiguration,
    AutoInstrumentationConfiguration,
    InitializationModeForTelemetry
} from './DdSdkReactNativeConfiguration';
import { InternalLog } from './InternalLog';
import { SdkVerbosity } from './SdkVerbosity';
import type { TrackingConsent } from './TrackingConsent';
import { DdLogs } from './logs/DdLogs';
import { DdRum } from './rum/DdRum';
import { DdRumErrorTracking } from './rum/instrumentation/DdRumErrorTracking';
import { DdRumUserInteractionTracking } from './rum/instrumentation/interactionTracking/DdRumUserInteractionTracking';
import { DdRumResourceTracking } from './rum/instrumentation/resourceTracking/DdRumResourceTracking';
import { AttributesSingleton } from './sdk/AttributesSingleton/AttributesSingleton';
import type { Attributes } from './sdk/AttributesSingleton/types';
import { BufferSingleton } from './sdk/DatadogProvider/Buffer/BufferSingleton';
import { DdSdk } from './sdk/DdSdk';
import { FileBasedConfiguration } from './sdk/FileBasedConfiguration/FileBasedConfiguration';
import { GlobalState } from './sdk/GlobalState/GlobalState';
import { UserInfoSingleton } from './sdk/UserInfoSingleton/UserInfoSingleton';
import type { UserInfo } from './sdk/UserInfoSingleton/types';
import { DdSdkConfiguration } from './types';
import { adaptLongTaskThreshold } from './utils/longTasksUtils';
import { version as sdkVersion } from './version';

/**
 * This class initializes the Datadog SDK, and sets up communication with the server.
 */
export class DdSdkReactNative {
    private static readonly DD_SOURCE_KEY = '_dd.source';
    private static readonly DD_SDK_VERSION = '_dd.sdk_version';
    private static readonly DD_VERSION = '_dd.version';
    private static readonly DD_VERSION_SUFFIX = '_dd.version_suffix';
    private static readonly DD_REACT_NATIVE_VERSION =
        '_dd.react_native_version';

    private static wasAutoInstrumented = false;
    private static features?: AutoInstrumentationConfiguration;

    /**
     * Initializes the Datadog SDK.
     * @param configuration the configuration for the SDK library
     * @returns a Promise.
     */
    static initialize = async (
        configuration: DdSdkReactNativeConfiguration
    ): Promise<void> => {
        await DdSdkReactNative.initializeNativeSDK(configuration, {
            initializationModeForTelemetry: 'LEGACY'
        });
        DdSdkReactNative.enableFeatures(configuration);
    };

    private static initializeNativeSDK = async (
        configuration: DdSdkReactNativeConfiguration,
        params: {
            initializationModeForTelemetry: InitializationModeForTelemetry;
        }
    ): Promise<void> => {
        if (GlobalState.instance.isInitialized) {
            InternalLog.log(
                "Can't initialize Datadog, SDK was already initialized",
                SdkVerbosity.WARN
            );
            if (!__DEV__) {
                DdSdk.telemetryDebug(
                    'RN SDK was already initialized in javascript'
                );
            }
            return new Promise(resolve => resolve());
        }

        InternalLog.verbosity = configuration.verbosity;

        await DdSdk.initialize(
            DdSdkReactNative.buildConfiguration(configuration, params)
        );
        InternalLog.log('Datadog SDK was initialized', SdkVerbosity.INFO);
        GlobalState.instance.isInitialized = true;
        BufferSingleton.onInitialization();
    };

    /**
     * FOR INTERNAL USE ONLY.
     */
    static async _initializeFromDatadogProvider(
        configuration: DatadogProviderConfiguration
    ): Promise<void> {
        DdSdkReactNative.enableFeatures(configuration);
        if (configuration instanceof FileBasedConfiguration) {
            return DdSdkReactNative.initializeNativeSDK(configuration, {
                initializationModeForTelemetry: 'FILE'
            });
        }
        if (configuration.initializationMode === InitializationMode.SYNC) {
            return DdSdkReactNative.initializeNativeSDK(configuration, {
                initializationModeForTelemetry: 'SYNC'
            });
        }
        if (configuration.initializationMode === InitializationMode.ASYNC) {
            return InteractionManager.runAfterInteractions(() => {
                return DdSdkReactNative.initializeNativeSDK(configuration, {
                    initializationModeForTelemetry: 'ASYNC'
                });
            });
        }
        // TODO: Remove when DdSdkReactNativeConfiguration is deprecated
        if (configuration instanceof DdSdkReactNativeConfiguration) {
            return DdSdkReactNative.initializeNativeSDK(configuration, {
                initializationModeForTelemetry: 'SYNC'
            });
        }
    }

    /**
     * FOR INTERNAL USE ONLY.
     */
    static async _enableFeaturesFromDatadogProvider(
        features: AutoInstrumentationConfiguration
    ): Promise<void> {
        DdSdkReactNative.features = features;
        DdSdkReactNative.enableFeatures(
            addDefaultValuesToAutoInstrumentationConfiguration(features)
        );
    }

    /**
     * FOR INTERNAL USE ONLY.
     */
    static _initializeFromDatadogProviderWithConfigurationAsync = async (
        configuration: PartialInitializationConfiguration
    ): Promise<void> => {
        if (!DdSdkReactNative.features) {
            InternalLog.log(
                "Can't initialize Datadog, make sure the DatadogProvider component is mounted before calling this function",
                SdkVerbosity.WARN
            );
            return new Promise(resolve => resolve());
        }

        return DdSdkReactNative.initializeNativeSDK(
            buildConfigurationFromPartialConfiguration(
                DdSdkReactNative.features,
                configuration
            ),
            { initializationModeForTelemetry: 'PARTIAL' }
        );
    };

    /**
     * Adds a set of attributes to the global context attached with all future Logs, Spans and RUM events.
     * To remove an attribute, set it to `undefined` in a call to `setAttributes`.
     * @param attributes: The global context attributes.
     * @returns a Promise.
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    static setAttributes = async (attributes: Attributes): Promise<void> => {
        InternalLog.log(
            `Setting attributes ${JSON.stringify(attributes)}`,
            SdkVerbosity.DEBUG
        );
        await DdSdk.setAttributes(attributes);
        AttributesSingleton.getInstance().setAttributes(attributes);
    };

    /**
     * Set the user information.
     * @param user: The user object (use builtin attributes: 'id', 'email', 'name', and/or any custom attribute).
     * @returns a Promise.
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    static setUser = async (user: UserInfo): Promise<void> => {
        InternalLog.log(
            `Setting user ${JSON.stringify(user)}`,
            SdkVerbosity.DEBUG
        );
        await DdSdk.setUser(user);
        UserInfoSingleton.getInstance().setUserInfo(user);
    };

    /**
     * Set the user information.
     * @param extraUserInfo: The extra info object (use builtin attributes: 'id', 'email', 'name', and/or any custom attribute).
     * @returns a Promise.
     */
    static addUserExtraInfo = async (
        extraUserInfo: UserInfo
    ): Promise<void> => {
        InternalLog.log(
            `Adding extra user info ${JSON.stringify(extraUserInfo)}`,
            SdkVerbosity.DEBUG
        );
        const userInfo = UserInfoSingleton.getInstance().getUserInfo();
        const updatedUserInfo = { ...userInfo, ...extraUserInfo };
        await DdSdk.setUser(updatedUserInfo);
        UserInfoSingleton.getInstance().setUserInfo(updatedUserInfo);
    };

    /**
     * Set the tracking consent regarding the data collection.
     * @param trackingConsent: One of TrackingConsent values.
     * @returns a Promise.
     */
    static setTrackingConsent = (consent: TrackingConsent): Promise<void> => {
        InternalLog.log(`Setting consent ${consent}`, SdkVerbosity.DEBUG);
        return DdSdk.setTrackingConsent(consent);
    };

    /**
     * Clears all data that has not already been sent to Datadog servers
     * @returns a Promise
     */
    static clearAllData = (): Promise<void> => {
        InternalLog.log('Clearing all data', SdkVerbosity.DEBUG);
        return DdSdk.clearAllData();
    };

    private static buildConfiguration = (
        configuration: DdSdkReactNativeConfiguration,
        params: {
            initializationModeForTelemetry: InitializationModeForTelemetry;
        }
    ): DdSdkConfiguration => {
        configuration.additionalConfiguration[DdSdkReactNative.DD_SOURCE_KEY] =
            'react-native';
        configuration.additionalConfiguration[
            DdSdkReactNative.DD_SDK_VERSION
        ] = sdkVersion;

        if (configuration.version) {
            configuration.additionalConfiguration[
                DdSdkReactNative.DD_VERSION
            ] = `${configuration.version}${
                configuration.versionSuffix
                    ? `-${configuration.versionSuffix}`
                    : ''
            }`;
        }
        // If both version and version suffix are provided, we merge them into the version field.
        // To avoid adding it in again the native part, we only set it if the version isn't set.
        if (configuration.versionSuffix && !configuration.version) {
            configuration.additionalConfiguration[
                DdSdkReactNative.DD_VERSION_SUFFIX
            ] = `-${configuration.versionSuffix}`;
        }

        if (reactNativeVersion) {
            configuration.additionalConfiguration[
                DdSdkReactNative.DD_REACT_NATIVE_VERSION
            ] = `${reactNativeVersion}`;
        }

        return new DdSdkConfiguration(
            configuration.clientToken,
            configuration.env,
            configuration.applicationId,
            configuration.nativeCrashReportEnabled,
            adaptLongTaskThreshold(configuration.nativeLongTaskThresholdMs),
            adaptLongTaskThreshold(configuration.longTaskThresholdMs),
            configuration.sampleRate === undefined
                ? configuration.sessionSamplingRate
                : configuration.sampleRate,
            configuration.site,
            configuration.trackingConsent,
            configuration.additionalConfiguration,
            configuration.telemetrySampleRate,
            configuration.vitalsUpdateFrequency,
            configuration.uploadFrequency,
            configuration.batchSize,
            configuration.trackFrustrations,
            configuration.trackBackgroundEvents,
            configuration.customEndpoints,
            {
                initializationType: params.initializationModeForTelemetry,
                trackErrors: configuration.trackErrors,
                trackInteractions: configuration.trackInteractions,
                trackNetworkRequests: configuration.trackResources,
                // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
                reactNativeVersion: require('react-native/package.json')
                    .version,
                // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
                reactVersion: require('react/package.json').version
            },
            configuration.nativeViewTracking,
            configuration.nativeInteractionTracking,
            configuration.verbosity,
            configuration.proxyConfig,
            configuration.serviceName,
            formatFirstPartyHosts(configuration.firstPartyHosts),
            configuration.bundleLogsWithRum,
            configuration.bundleLogsWithTraces,
            configuration.trackNonFatalAnrs,
            configuration.appHangThreshold,
            configuration.resourceTracingSamplingRate
        );
    };

    private static enableFeatures(
        configuration: AutoInstrumentationParameters
    ) {
        if (DdSdkReactNative.wasAutoInstrumented) {
            InternalLog.log(
                "Can't auto instrument Datadog, SDK was already instrumented",
                SdkVerbosity.WARN
            );
            return;
        }

        if (configuration.trackInteractions) {
            DdRumUserInteractionTracking.startTracking({
                actionNameAttribute: configuration.actionNameAttribute,
                useAccessibilityLabel: configuration.useAccessibilityLabel
            });
        }

        if (configuration.trackResources) {
            DdRumResourceTracking.startTracking({
                tracingSamplingRate: configuration.resourceTracingSamplingRate,
                firstPartyHosts: formatFirstPartyHosts(
                    configuration.firstPartyHosts
                )
            });
        }

        if (configuration.trackErrors) {
            DdRumErrorTracking.startTracking();
        }

        if (configuration.logEventMapper) {
            DdLogs.registerLogEventMapper(configuration.logEventMapper);
        }

        if (configuration.errorEventMapper) {
            DdRum.registerErrorEventMapper(configuration.errorEventMapper);
        }

        if (configuration.resourceEventMapper) {
            DdRum.registerResourceEventMapper(
                configuration.resourceEventMapper
            );
        }

        if (configuration.actionEventMapper) {
            DdRum.registerActionEventMapper(configuration.actionEventMapper);
        }

        DdSdkReactNative.wasAutoInstrumented = true;
    }
}
