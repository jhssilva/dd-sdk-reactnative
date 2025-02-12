/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

import { DATADOG_MESSAGE_PREFIX, InternalLog } from '../InternalLog';
import { SdkVerbosity } from '../SdkVerbosity';
import type { DdNativeLogsType } from '../nativeModulesTypes';
import { DdAttributes } from '../rum/DdAttributes';
import type { ErrorSource } from '../rum/types';
import { validateContext } from '../utils/argsUtils';

import { generateEventMapper } from './eventMapper';
import type {
    DdLogsType,
    LogArguments,
    LogEventMapper,
    LogWithErrorArguments,
    NativeLogWithError,
    RawLogWithError
} from './types';

const SDK_NOT_INITIALIZED_MESSAGE = 'DD_INTERNAL_LOG_SENT_BEFORE_SDK_INIT';

const generateEmptyPromise = () => new Promise<void>(resolve => resolve());

/**
 * We consider that if either one of `errorKind`, `errorMessage` or `stacktrace` is a string,
 * then the log contains an error.
 */
const isLogWithError = (
    args: LogArguments | LogWithErrorArguments
): args is LogWithErrorArguments => {
    return (
        typeof args[1] === 'string' ||
        typeof args[2] === 'string' ||
        typeof args[3] === 'string' ||
        typeof args[4] === 'object' ||
        typeof args[5] === 'string'
    );
};

class DdLogsWrapper implements DdLogsType {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    private nativeLogs: DdNativeLogsType = require('../specs/NativeDdLogs')
        .default;
    private logEventMapper = generateEventMapper(undefined);

    debug = (...args: LogArguments | LogWithErrorArguments): Promise<void> => {
        if (isLogWithError(args)) {
            return this.logWithError(
                args[0],
                args[1],
                args[2],
                args[3],
                validateContext(args[4]),
                'debug',
                args[5]
            );
        }
        return this.log(args[0], validateContext(args[1]), 'debug');
    };

    info = (...args: LogArguments | LogWithErrorArguments): Promise<void> => {
        if (isLogWithError(args)) {
            return this.logWithError(
                args[0],
                args[1],
                args[2],
                args[3],
                validateContext(args[4]),
                'info',
                args[5]
            );
        }
        return this.log(args[0], validateContext(args[1]), 'info');
    };

    warn = (...args: LogArguments | LogWithErrorArguments): Promise<void> => {
        if (isLogWithError(args)) {
            return this.logWithError(
                args[0],
                args[1],
                args[2],
                args[3],
                validateContext(args[4]),
                'warn',
                args[5]
            );
        }
        return this.log(args[0], validateContext(args[1]), 'warn');
    };

    error = (...args: LogArguments | LogWithErrorArguments): Promise<void> => {
        if (isLogWithError(args)) {
            return this.logWithError(
                args[0],
                args[1],
                args[2],
                args[3],
                validateContext(args[4]),
                'error',
                args[5],
                args[6]
            );
        }
        return this.log(args[0], validateContext(args[1]), 'error');
    };

    /**
     * Since the InternalLog does not have a verbosity set yet in this case,
     * we use console.warn to warn the user in dev mode.
     */
    private printLogDroppedSdkNotInitialized = (
        message: string,
        status: 'debug' | 'info' | 'warn' | 'error'
    ) => {
        if (__DEV__) {
            console.warn(
                `${DATADOG_MESSAGE_PREFIX} Dropping ${status} log as the SDK is not initialized yet: "${message}"`
            );
        }
    };

    private printLogDroppedByMapper = (
        message: string,
        status: 'debug' | 'info' | 'warn' | 'error'
    ) => {
        InternalLog.log(
            `${status} log dropped by log mapper: "${message}"`,
            SdkVerbosity.DEBUG
        );
    };

    private printLogTracked = (
        message: string,
        status: 'debug' | 'info' | 'warn' | 'error'
    ) => {
        InternalLog.log(
            `Tracking ${status} log "${message}"`,
            SdkVerbosity.DEBUG
        );
    };

    private log = async (
        message: string,
        context: object,
        status: 'debug' | 'info' | 'warn' | 'error'
    ): Promise<void> => {
        const event = this.logEventMapper.applyEventMapper({
            message,
            context,
            status
        });
        if (!event) {
            this.printLogDroppedByMapper(message, status);
            return generateEmptyPromise();
        }

        this.printLogTracked(event.message, status);
        try {
            return await this.nativeLogs[status](event.message, event.context);
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (error.message === SDK_NOT_INITIALIZED_MESSAGE) {
                this.printLogDroppedSdkNotInitialized(message, status);
                return generateEmptyPromise();
            }

            throw error;
        }
    };

    private logWithError = async (
        message: string,
        errorKind: string | undefined,
        errorMessage: string | undefined,
        stacktrace: string | undefined,
        context: object,
        status: 'debug' | 'info' | 'warn' | 'error',
        fingerprint?: string,
        source?: ErrorSource
    ): Promise<void> => {
        const rawLogEvent: RawLogWithError = {
            message,
            errorKind,
            errorMessage,
            stacktrace,
            context,
            status,
            fingerprint: fingerprint ?? '',
            source
        };

        const mappedEvent = this.logEventMapper.applyEventMapper(rawLogEvent);

        if (!mappedEvent) {
            this.printLogDroppedByMapper(message, status);
            return generateEmptyPromise();
        }

        this.printLogTracked(mappedEvent.message, status);
        try {
            const updatedContext = {
                ...mappedEvent.context,
                [DdAttributes.errorSourceType]: 'react-native'
            };

            if (fingerprint && fingerprint !== '') {
                updatedContext[DdAttributes.errorFingerprint] = fingerprint;
            }

            return await this.nativeLogs[`${status}WithError`](
                mappedEvent.message,
                (mappedEvent as NativeLogWithError).errorKind,
                (mappedEvent as NativeLogWithError).errorMessage,
                (mappedEvent as NativeLogWithError).stacktrace,
                updatedContext
            );
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            if (error.message === SDK_NOT_INITIALIZED_MESSAGE) {
                this.printLogDroppedSdkNotInitialized(message, status);
                return generateEmptyPromise();
            }

            throw error;
        }
    };

    registerLogEventMapper(logEventMapper: LogEventMapper) {
        this.logEventMapper = generateEventMapper(logEventMapper);
    }

    unregisterLogEventMapper() {
        this.logEventMapper = generateEventMapper(undefined);
    }
}

export const DdLogs = new DdLogsWrapper();
