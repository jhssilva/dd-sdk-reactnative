/* eslint-disable @typescript-eslint/ban-ts-comment */
/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

import BigInt from 'big-integer';
import { NativeModules } from 'react-native';

import { InternalLog } from '../../InternalLog';
import { SdkVerbosity } from '../../SdkVerbosity';
import { BufferSingleton } from '../../sdk/DatadogProvider/Buffer/BufferSingleton';
import { DdSdk } from '../../sdk/DdSdk';
import { GlobalState } from '../../sdk/GlobalState/GlobalState';
import { DdRum } from '../DdRum';
import type { ActionEventMapper } from '../eventMappers/actionEventMapper';
import type { ErrorEventMapper } from '../eventMappers/errorEventMapper';
import type { ResourceEventMapper } from '../eventMappers/resourceEventMapper';
import { TracingIdType } from '../instrumentation/resourceTracking/distributedTracing/TracingIdentifier';
import { TracingIdentifierUtils } from '../instrumentation/resourceTracking/distributedTracing/__tests__/__utils__/TracingIdentifierUtils';
import { ErrorSource, PropagatorType, RumActionType } from '../types';

jest.mock('../../utils/time-provider/DefaultTimeProvider', () => {
    return {
        DefaultTimeProvider: jest.fn().mockImplementation(() => {
            return { now: jest.fn().mockReturnValue(456) };
        })
    };
});

jest.mock('../../InternalLog', () => {
    return {
        InternalLog: {
            log: jest.fn()
        },
        DATADOG_MESSAGE_PREFIX: 'DATADOG:'
    };
});

describe('DdRum', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        BufferSingleton.onInitialization();
    });

    describe('Context validation', () => {
        describe('DdRum.startView', () => {
            test('uses given context when context is valid', async () => {
                const context = {
                    testA: 123,
                    testB: 'ok'
                };
                await DdRum.startView('key', 'name', context);

                expect(NativeModules.DdRum.startView).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    context,
                    expect.anything()
                );
            });

            test('uses empty context with error when context is invalid or null', async () => {
                const context: any = 123;
                await DdRum.startView('key', 'name', context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    2,
                    expect.anything(),
                    SdkVerbosity.ERROR
                );

                expect(NativeModules.DdRum.startView).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    {},
                    expect.anything()
                );
            });

            test('nests given context in new object when context is array', async () => {
                const context: any = [123, '456'];
                await DdRum.startView('key', 'name', context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    2,
                    expect.anything(),
                    SdkVerbosity.WARN
                );

                expect(NativeModules.DdRum.startView).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    { context },
                    expect.anything()
                );
            });
        });

        describe('DdRum.stopView', () => {
            test('uses given context when context is valid', async () => {
                const context = {
                    testA: 123,
                    testB: 'ok'
                };
                await DdRum.startView('key', 'name');
                await DdRum.stopView('key', context);

                expect(NativeModules.DdRum.stopView).toHaveBeenCalledWith(
                    'key',
                    context,
                    expect.anything()
                );
            });

            test('uses empty context with error when context is invalid or null', async () => {
                const context: any = 123;

                await DdRum.startView('key', 'name');
                await DdRum.stopView('key', context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    3,
                    expect.anything(),
                    SdkVerbosity.ERROR
                );

                expect(NativeModules.DdRum.stopView).toHaveBeenCalledWith(
                    'key',
                    {},
                    expect.anything()
                );
            });

            test('nests given context in new object when context is array', async () => {
                const context: any = [123, '456'];

                await DdRum.startView('key', 'name');
                await DdRum.stopView('key', context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    3,
                    expect.anything(),
                    SdkVerbosity.WARN
                );

                expect(NativeModules.DdRum.stopView).toHaveBeenCalledWith(
                    'key',
                    { context },
                    expect.anything()
                );
            });
        });

        describe('DdRum.startAction', () => {
            test('uses given context when context is valid', async () => {
                const context = {
                    testA: 123,
                    testB: 'ok'
                };
                await DdRum.startAction(RumActionType.SCROLL, 'name', context);

                expect(NativeModules.DdRum.startAction).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    context,
                    expect.anything()
                );
            });

            test('uses empty context with error when context is invalid or null', async () => {
                const context: any = 123;
                await DdRum.startAction(RumActionType.SCROLL, 'name', context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    2,
                    expect.anything(),
                    SdkVerbosity.ERROR
                );

                expect(NativeModules.DdRum.startAction).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    {},
                    expect.anything()
                );
            });

            test('nests given context in new object when context is array', async () => {
                const context: any = [123, '456'];
                await DdRum.startAction(RumActionType.SCROLL, 'name', context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    2,
                    expect.anything(),
                    SdkVerbosity.WARN
                );

                expect(NativeModules.DdRum.startAction).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    { context },
                    expect.anything()
                );
            });
        });

        describe('DdRum.stopAction', () => {
            describe('New API', () => {
                test('uses given context when context is valid', async () => {
                    const context = {
                        testA: 123,
                        testB: 'ok'
                    };
                    await DdRum.startAction(RumActionType.SCROLL, 'name');
                    await DdRum.stopAction(
                        RumActionType.SCROLL,
                        'name',
                        context
                    );

                    expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                        RumActionType.SCROLL,
                        'name',
                        context,
                        expect.anything()
                    );
                });

                test('uses empty context with error when context is invalid or null', async () => {
                    const context: any = 123;

                    await DdRum.startAction(RumActionType.SCROLL, 'name');
                    await DdRum.stopAction(
                        RumActionType.SCROLL,
                        'name',
                        context
                    );

                    expect(InternalLog.log).toHaveBeenNthCalledWith(
                        3,
                        expect.anything(),
                        SdkVerbosity.ERROR
                    );

                    expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                        RumActionType.SCROLL,
                        'name',
                        {},
                        expect.anything()
                    );
                });

                test('nests given context in new object when context is array', async () => {
                    const context: any = [123, '456'];

                    await DdRum.startAction(RumActionType.SCROLL, 'name');
                    await DdRum.stopAction(
                        RumActionType.SCROLL,
                        'name',
                        context
                    );

                    expect(InternalLog.log).toHaveBeenNthCalledWith(
                        3,
                        expect.anything(),
                        SdkVerbosity.WARN
                    );

                    expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                        RumActionType.SCROLL,
                        'name',
                        { context },
                        expect.anything()
                    );
                });
            });

            describe('Old API', () => {
                test('uses given context when context is valid', async () => {
                    const context = {
                        testA: 123,
                        testB: 'ok'
                    };
                    await DdRum.startAction(RumActionType.SCROLL, 'name');
                    await DdRum.stopAction(context);

                    expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                        RumActionType.SCROLL,
                        'name',
                        context,
                        expect.anything()
                    );
                });

                test('uses empty context with error when context is invalid or null', async () => {
                    await DdRum.startAction(RumActionType.SCROLL, 'name');
                    await DdRum.stopAction(undefined);

                    expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                        RumActionType.SCROLL,
                        'name',
                        {},
                        expect.anything()
                    );
                });

                test('nests given context in new object when context is array', async () => {
                    const context: any = [123, '456'];

                    await DdRum.startAction(RumActionType.SCROLL, 'name');
                    await DdRum.stopAction(context);

                    expect(InternalLog.log).toHaveBeenNthCalledWith(
                        3,
                        expect.anything(),
                        SdkVerbosity.WARN
                    );

                    expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                        RumActionType.SCROLL,
                        'name',
                        { context },
                        expect.anything()
                    );
                });
            });
        });

        describe('DdRum.startResource', () => {
            test('uses given context when context is valid', async () => {
                const context = {
                    testA: 123,
                    testB: 'ok'
                };
                await DdRum.startResource('key', 'method', 'url', context);

                expect(NativeModules.DdRum.startResource).toHaveBeenCalledWith(
                    'key',
                    'method',
                    'url',
                    context,
                    expect.anything()
                );
            });

            test('uses empty context with error when context is invalid or null', async () => {
                const context: any = 123;

                await DdRum.startResource('key', 'method', 'url', context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    2,
                    expect.anything(),
                    SdkVerbosity.ERROR
                );

                expect(NativeModules.DdRum.startResource).toHaveBeenCalledWith(
                    'key',
                    'method',
                    'url',
                    {},
                    expect.anything()
                );
            });

            test('nests given context in new object when context is array', async () => {
                const context: any = [123, '456'];

                await DdRum.startResource('key', 'method', 'url', context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    2,
                    expect.anything(),
                    SdkVerbosity.WARN
                );

                expect(NativeModules.DdRum.startResource).toHaveBeenCalledWith(
                    'key',
                    'method',
                    'url',
                    { context },
                    expect.anything()
                );
            });
        });

        describe('DdRum.stopResource', () => {
            test('uses given context when context is valid', async () => {
                const context = {
                    testA: 123,
                    testB: 'ok'
                };

                await DdRum.startResource('key', 'method', 'url', {});
                await DdRum.stopResource('key', 200, 'other', -1, context);

                expect(NativeModules.DdRum.stopResource).toHaveBeenCalledWith(
                    'key',
                    200,
                    'other',
                    -1,
                    context,
                    expect.anything()
                );
            });

            test('uses empty context with error when context is invalid or null', async () => {
                const context: any = 123;

                await DdRum.startResource('key', 'method', 'url', {});
                await DdRum.stopResource('key', 200, 'other', -1, context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    2,
                    expect.anything(),
                    SdkVerbosity.ERROR
                );

                expect(NativeModules.DdRum.stopResource).toHaveBeenCalledWith(
                    'key',
                    200,
                    'other',
                    -1,
                    {},
                    expect.anything()
                );
            });

            test('nests given context in new object when context is array', async () => {
                const context: any = [123, '456'];

                await DdRum.startResource('key', 'method', 'url', {});
                await DdRum.stopResource('key', 200, 'other', -1, context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    2,
                    expect.anything(),
                    SdkVerbosity.WARN
                );

                expect(NativeModules.DdRum.stopResource).toHaveBeenCalledWith(
                    'key',
                    200,
                    'other',
                    -1,
                    { context },
                    expect.anything()
                );
            });
        });

        describe('DdRum.addAction', () => {
            test('uses given context when context is valid', async () => {
                const context = {
                    testA: 123,
                    testB: 'ok'
                };
                await DdRum.addAction(RumActionType.SCROLL, 'name', context);

                expect(NativeModules.DdRum.addAction).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    context,
                    expect.anything()
                );
            });

            test('uses empty context with error when context is invalid or null', async () => {
                const context: any = 123;
                await DdRum.addAction(RumActionType.SCROLL, 'name', context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    1,
                    expect.anything(),
                    SdkVerbosity.ERROR
                );

                expect(NativeModules.DdRum.addAction).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    {},
                    expect.anything()
                );
            });

            test('nests given context in new object when context is array', async () => {
                const context: any = [123, '456'];
                await DdRum.addAction(RumActionType.SCROLL, 'name', context);

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    1,
                    expect.anything(),
                    SdkVerbosity.WARN
                );

                expect(NativeModules.DdRum.addAction).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.anything(),
                    { context },
                    expect.anything()
                );
            });
        });

        describe('DdRum.addError', () => {
            test('uses given context when context is valid', async () => {
                const context = {
                    testA: 123,
                    testB: 'ok'
                };

                await DdRum.addError(
                    'error',
                    ErrorSource.CUSTOM,
                    'stacktrace',
                    context
                );

                expect(NativeModules.DdRum.addError).toHaveBeenCalledWith(
                    'error',
                    ErrorSource.CUSTOM,
                    'stacktrace',
                    {
                        ...context,
                        '_dd.error.source_type': 'react-native'
                    },
                    expect.anything(),
                    ''
                );
            });

            test('uses empty context with error when context is invalid or null', async () => {
                const context: any = 123;
                await DdRum.addError(
                    'error',
                    ErrorSource.CUSTOM,
                    'stacktrace',
                    context
                );

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    1,
                    expect.anything(),
                    SdkVerbosity.ERROR
                );

                expect(NativeModules.DdRum.addError).toHaveBeenCalledWith(
                    'error',
                    ErrorSource.CUSTOM,
                    'stacktrace',
                    {
                        '_dd.error.source_type': 'react-native'
                    },
                    expect.anything(),
                    ''
                );
            });

            test('nests given context in new object when context is array', async () => {
                const context: any = [123, '456'];
                await DdRum.addError(
                    'error',
                    ErrorSource.CUSTOM,
                    'stacktrace',
                    context
                );

                expect(InternalLog.log).toHaveBeenNthCalledWith(
                    1,
                    expect.anything(),
                    SdkVerbosity.WARN
                );

                expect(NativeModules.DdRum.addError).toHaveBeenCalledWith(
                    'error',
                    ErrorSource.CUSTOM,
                    'stacktrace',
                    {
                        context,
                        '_dd.error.source_type': 'react-native'
                    },
                    expect.anything(),
                    ''
                );
            });
        });
    });

    describe('DdRum.stopAction', () => {
        test('calls the native SDK when called with new API', async () => {
            await DdRum.stopAction(
                RumActionType.SCROLL,
                'page',
                { user: 'me' },
                123
            );
            expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                RumActionType.SCROLL,
                'page',
                { user: 'me' },
                123
            );
        });

        test('calls the native SDK when called with new API with default values', async () => {
            await DdRum.stopAction(RumActionType.SCROLL, 'page');
            expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                RumActionType.SCROLL,
                'page',
                {},
                456
            );
        });

        test('does not call the native SDK when startAction has not been called before and using old API', async () => {
            await DdRum.stopAction({ user: 'me' }, 789);
            expect(NativeModules.DdRum.stopAction).not.toHaveBeenCalled();
            expect(DdSdk.telemetryDebug).not.toHaveBeenCalled();
        });

        test('calls the native SDK when called with old API', async () => {
            await DdRum.startAction(RumActionType.SCROLL, 'page_old_api');
            await DdRum.stopAction({ user: 'me' }, 789);
            expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                RumActionType.SCROLL,
                'page_old_api',
                { user: 'me' },
                789
            );
            expect(DdSdk.telemetryDebug).toHaveBeenCalledWith(
                'DDdRum.stopAction called with the old signature'
            );
        });

        test('calls the native SDK when called with old API with default values', async () => {
            await DdRum.startAction(RumActionType.SCROLL, 'page_old_api');
            await DdRum.stopAction();
            expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                RumActionType.SCROLL,
                'page_old_api',
                {},
                456
            );
            expect(DdSdk.telemetryDebug).toHaveBeenCalledWith(
                'DDdRum.stopAction called with the old signature'
            );
        });

        test('cleans the action data when stopAction is called', async () => {
            await DdRum.startAction(RumActionType.SCROLL, 'page_old_api');
            await DdRum.stopAction();
            await DdRum.stopAction();
            expect(NativeModules.DdRum.stopAction).toHaveBeenCalledTimes(1);
        });
    });

    describe('DdRumWrapper', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            BufferSingleton.onInitialization();
        });

        it('M add error source type W addError()', async () => {
            // Given
            const message = 'Oops I did it again!';
            const source = ErrorSource.SOURCE;
            const stacktrace = 'doSomething() at ./path/to/file.js:67:3';

            // When
            DdRum.addError(message, source, stacktrace);

            // Then
            expect(NativeModules.DdRum.addError.mock.calls.length).toBe(1);
            expect(NativeModules.DdRum.addError.mock.calls[0][0]).toBe(message);
            expect(NativeModules.DdRum.addError.mock.calls[0][1]).toBe(source);
            expect(NativeModules.DdRum.addError.mock.calls[0][2]).toBe(
                stacktrace
            );
            const context = NativeModules.DdRum.addError.mock.calls[0][3];
            expect(context['_dd.error.source_type']).toStrictEqual(
                'react-native'
            );
        });

        it('M add error fingerprint W addError() { with custom fingerprint }', async () => {
            // Given
            const message = 'Oops I did it again!';
            const source = ErrorSource.SOURCE;
            const stacktrace = 'doSomething() at ./path/to/file.js:67:3';

            // When
            DdRum.addError(
                message,
                source,
                stacktrace,
                undefined,
                undefined,
                'custom-fingerprint'
            );

            // Then
            expect(NativeModules.DdRum.addError.mock.calls.length).toBe(1);
            expect(NativeModules.DdRum.addError.mock.calls[0][0]).toBe(message);
            expect(NativeModules.DdRum.addError.mock.calls[0][1]).toBe(source);
            expect(NativeModules.DdRum.addError.mock.calls[0][2]).toBe(
                stacktrace
            );
            const context = NativeModules.DdRum.addError.mock.calls[0][3];
            expect(context['_dd.error.source_type']).toStrictEqual(
                'react-native'
            );
            expect(NativeModules.DdRum.addError.mock.calls[0][5]).toBe(
                'custom-fingerprint'
            );
        });

        it('M add error source type W addError() {with custom attributes}', async () => {
            // Given
            const message = 'Oops I did it again!';
            const source = ErrorSource.SOURCE;
            const stacktrace = 'doSomething() at ./path/to/file.js:67:3';
            const random = Math.random();
            const attributes = {
                foo: 'bar',
                spam: random
            };

            // When
            DdRum.addError(message, source, stacktrace, attributes);

            // Then
            expect(NativeModules.DdRum.addError.mock.calls.length).toBe(1);
            expect(NativeModules.DdRum.addError.mock.calls[0][0]).toBe(message);
            expect(NativeModules.DdRum.addError.mock.calls[0][1]).toBe(source);
            expect(NativeModules.DdRum.addError.mock.calls[0][2]).toBe(
                stacktrace
            );
            const context = NativeModules.DdRum.addError.mock.calls[0][3];
            expect(context['_dd.error.source_type']).toStrictEqual(
                'react-native'
            );
            expect(context['foo']).toStrictEqual('bar');
            expect(context['spam']).toStrictEqual(random);
        });
    });

    describe('DdRum.addError', () => {
        it('registers event mapper and maps error', async () => {
            const errorEventMapper: ErrorEventMapper = error => {
                error.message = 'New message';
                error.context = {
                    isFatal: true
                };
                return error;
            };
            DdRum.registerErrorEventMapper(errorEventMapper);

            await DdRum.addError('Old message', ErrorSource.CUSTOM, 'stack', {
                isFatal: false
            });
            expect(NativeModules.DdRum.addError).toHaveBeenCalledWith(
                'New message',
                'CUSTOM',
                'stack',
                {
                    '_dd.error.source_type': 'react-native',
                    isFatal: true
                },
                456,
                ''
            );
        });

        it('drops the event if the mapper returns null', async () => {
            const errorEventMapper: ErrorEventMapper = error => {
                return null;
            };

            DdRum.registerErrorEventMapper(errorEventMapper);

            await DdRum.addError('Old message', ErrorSource.CUSTOM, 'stack', {
                isFatal: false
            });
            expect(NativeModules.DdRum.addError).not.toHaveBeenCalled();
        });
    });

    describe('DdRum.stopResource', () => {
        it('registers event mapper and maps resource', async () => {
            const resourceEventMapper: ResourceEventMapper = resource => {
                resource.context = { retryAttempts: 3 };
                // @ts-ignore
                resource.key = 'bad key';
                // @ts-ignore
                resource.statusCode = 500;
                // @ts-ignore
                resource.kind = 'document';
                // @ts-ignore
                resource.size = 2000;
                return resource;
            };
            DdRum.registerResourceEventMapper(resourceEventMapper);

            await DdRum.startResource(
                'key',
                'GET',
                'https://my-api.com/',
                { retry: false },
                234
            );
            await DdRum.stopResource('key', 200, 'xhr', 302, {}, 245);
            expect(NativeModules.DdRum.stopResource).toHaveBeenCalledWith(
                'key',
                200,
                'xhr',
                302,
                { retryAttempts: 3 },
                245
            );
        });

        it('adds the drop context key to the event if the mapper returns null', async () => {
            const resourceEventMapper: ResourceEventMapper = resource => {
                return null;
            };

            DdRum.registerResourceEventMapper(resourceEventMapper);

            await DdRum.startResource(
                'key',
                'GET',
                'https://my-api.com/',
                { retry: false },
                234
            );
            await DdRum.stopResource(
                'key',
                200,
                'xhr',
                302,
                { someLargeUselessObject: {} },
                245
            );

            expect(NativeModules.DdRum.stopResource).toHaveBeenCalledWith(
                'key',
                200,
                'xhr',
                302,
                { '_dd.resource.drop_resource': true },
                245
            );
        });
    });

    describe('DdRum.addAction', () => {
        it('registers event mapper and maps action', async () => {
            const actionEventMapper: ActionEventMapper = action => {
                action.context = { frustration: true };
                return action;
            };
            DdRum.registerActionEventMapper(actionEventMapper);

            await DdRum.addAction(
                RumActionType.CUSTOM,
                'Click on button',
                {},
                123
            );
            expect(NativeModules.DdRum.addAction).toHaveBeenCalledWith(
                'CUSTOM',
                'Click on button',
                {
                    frustration: true
                },
                123
            );
        });

        it('drops the event if the mapper returns null', async () => {
            const actionEventMapper: ActionEventMapper = action => {
                action.context = { frustration: true };
                return null;
            };

            DdRum.registerActionEventMapper(actionEventMapper);

            await DdRum.addAction(
                RumActionType.CUSTOM,
                'Click on button',
                {},
                123
            );

            expect(NativeModules.DdRum.addAction).not.toHaveBeenCalled();
        });
    });

    describe('DdRum.stopAction', () => {
        it('registers event mapper and maps action', async () => {
            const actionEventMapper: ActionEventMapper = action => {
                action.context = { frustration: true };
                // @ts-ignore
                action.type = 'bad type';
                // @ts-ignore
                action.name = 'bad name';
                return action;
            };
            DdRum.registerActionEventMapper(actionEventMapper);

            await DdRum.startAction(
                RumActionType.CUSTOM,
                'Click on button',
                { frustration: false },
                234
            );
            await DdRum.stopAction(
                RumActionType.CUSTOM,
                'Click on button',
                { frustration: false },
                234
            );
            expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                'CUSTOM',
                'Click on button',
                { frustration: true },
                234
            );
        });

        it('adds the drop context key to the event if the mapper returns null', async () => {
            const actionEventMapper: ActionEventMapper = action => {
                return null;
            };

            DdRum.registerActionEventMapper(actionEventMapper);

            await DdRum.startAction(
                RumActionType.CUSTOM,
                'Click on button',
                { frustration: false },
                234
            );
            await DdRum.stopAction(
                RumActionType.CUSTOM,
                'Click on button',
                { frustration: false },
                234
            );

            expect(NativeModules.DdRum.stopAction).toHaveBeenCalledWith(
                'CUSTOM',
                'Click on button',
                { '_dd.action.drop_action': true },
                234
            );
        });
    });

    describe('DdRum.stopSession', () => {
        it('calls the native API', async () => {
            await DdRum.stopSession();
            expect(NativeModules.DdRum.stopSession).toHaveBeenCalledWith();
        });
    });

    describe('DdRum.getCurrentSessionId', () => {
        it('calls the native API if SDK is initialized', async () => {
            GlobalState.instance.isInitialized = true;
            const sessionId = await DdRum.getCurrentSessionId();
            expect(NativeModules.DdRum.getCurrentSessionId).toHaveBeenCalled();
            expect(sessionId).toBe('test-session-id');
        });
    });

    describe('DdRum.getCurrentSessionId', () => {
        it('returns undefined if SDK is not initialized', async () => {
            GlobalState.instance.isInitialized = false;
            const sessionId = await DdRum.getCurrentSessionId();
            expect(
                NativeModules.DdRum.getCurrentSessionId
            ).toHaveBeenCalledTimes(0);
            expect(sessionId).toBe(undefined);
        });
    });

    describe('PropagatorTypes', () => {
        it('matches with the native name of propagators', () => {
            /**
             * If you break this test by changing the value of the enum,
             * be sure to update the native implementation of
             * - ReadableArray.asTracingHeaderTypes (Android)
             * - asTracingHeaderType (iOS)
             * so that it uses the new values
             */
            expect(PropagatorType.DATADOG).toBe('datadog');
            expect(PropagatorType.B3).toBe('b3');
            expect(PropagatorType.B3MULTI).toBe('b3multi');
            expect(PropagatorType.TRACECONTEXT).toBe('tracecontext');
        });
    });

    describe('DdRum.generateUUID', () => {
        describe('required types are exposed', () => {
            it('PropragatorType is exposed', () => {
                expect(PropagatorType).toBeDefined();
            });

            it('TracingIdType is exposed', () => {
                expect(TracingIdType).toBeDefined();
            });
        });

        describe('generates a valid trace id', () => {
            it('in lowDecimal format with Datadog propagator type', () => {
                let iterations = 100;
                while (iterations-- > 0) {
                    const uuidStrLow64 = DdRum.generateUUID(
                        TracingIdType.trace,
                        PropagatorType.DATADOG
                    );

                    expect(uuidStrLow64).toBeDefined(); // Ensure the value is defined

                    expect(
                        TracingIdentifierUtils.isWithin64Bits(uuidStrLow64)
                    ).toBe(true);
                }
            });

            it('in paddedHex format with B3, B3multi and TraceContext propagator types', () => {
                let iterations = 100;
                const randomPropragatorType = [
                    PropagatorType.B3,
                    PropagatorType.B3MULTI,
                    PropagatorType.TRACECONTEXT
                ];
                while (iterations-- > 0) {
                    const uuidPaddedHex = DdRum.generateUUID(
                        TracingIdType.trace,
                        randomPropragatorType[
                            Math.floor(
                                Math.random() * randomPropragatorType.length
                            )
                        ]
                    );

                    expect(uuidPaddedHex).toBeDefined(); // Ensure the value is defined

                    expect(uuidPaddedHex).toMatch(
                        /^[0-9a-f]{8}[0]{8}[0-9a-f]{16}$/
                    );
                    expect(
                        TracingIdentifierUtils.isWithin128Bits(
                            uuidPaddedHex,
                            16
                        )
                    ).toBe(true);
                }
            });

            it('falls back to 64 bit span id when wrong tracingIdType is passed', () => {
                const uuid = DdRum.generateUUID(
                    ('wrong' as unknown) as TracingIdType,
                    PropagatorType.DATADOG
                );

                expect(uuid).toBeDefined(); // Ensure the value is defined
                expect(BigInt(uuid).greater(BigInt(0))).toBe(true); // Ensure it's a valid positive number
                expect(TracingIdentifierUtils.isWithin64Bits(uuid)).toBe(true); // Ensure the value is within 64 bits
                expect(uuid).toMatch(/^[0-9]+$/); // Ensure the value contains only decimal digits
            });
        });

        describe('generates a valid span id', () => {
            it('in Decimal format with Datadog propagator type', () => {
                let iterations = 100;
                while (iterations-- > 0) {
                    const uuid6StrDecimal64 = DdRum.generateUUID(
                        TracingIdType.span,
                        PropagatorType.DATADOG
                    );

                    expect(uuid6StrDecimal64).toBeDefined(); // Ensure the value is defined

                    expect(
                        TracingIdentifierUtils.isWithin64Bits(uuid6StrDecimal64)
                    ).toBe(true);
                }
            });

            it('in paddedHex format with B3, B3multi and TraceContext propagator types', () => {
                let iterations = 100;
                const randomPropragatorType = [
                    PropagatorType.B3,
                    PropagatorType.B3MULTI,
                    PropagatorType.TRACECONTEXT
                ];

                while (iterations-- > 0) {
                    const uuidStr128 = DdRum.generateUUID(
                        TracingIdType.span,
                        randomPropragatorType[
                            Math.floor(
                                Math.random() * randomPropragatorType.length
                            )
                        ]
                    );

                    expect(uuidStr128).toBeDefined(); // Ensure the value is defined

                    expect(uuidStr128).toMatch(/^[0-9a-f]{16}$/);
                    expect(
                        TracingIdentifierUtils.isWithin64Bits(uuidStr128, 16)
                    ).toBe(true);
                }
            });
        });
    });
});
