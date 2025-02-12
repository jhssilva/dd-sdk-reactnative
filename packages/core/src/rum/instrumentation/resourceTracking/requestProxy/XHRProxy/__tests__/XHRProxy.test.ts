/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

import BigInt from 'big-integer';
import { Platform, NativeModules } from 'react-native';

import { InternalLog } from '../../../../../../InternalLog';
import { SdkVerbosity } from '../../../../../../SdkVerbosity';
import { BufferSingleton } from '../../../../../../sdk/DatadogProvider/Buffer/BufferSingleton';
import { DdRum } from '../../../../../DdRum';
import { PropagatorType } from '../../../../../types';
import { XMLHttpRequestMock } from '../../../__tests__/__utils__/XMLHttpRequestMock';
import { TracingIdentifierUtils } from '../../../distributedTracing/__tests__/__utils__/TracingIdentifierUtils';
import {
    PARENT_ID_HEADER_KEY,
    TRACE_ID_HEADER_KEY,
    SAMPLING_PRIORITY_HEADER_KEY,
    TRACECONTEXT_HEADER_KEY,
    B3_HEADER_KEY,
    B3_MULTI_TRACE_ID_HEADER_KEY,
    B3_MULTI_SPAN_ID_HEADER_KEY,
    B3_MULTI_SAMPLED_HEADER_KEY,
    ORIGIN_RUM,
    ORIGIN_HEADER_KEY,
    TRACESTATE_HEADER_KEY,
    TAGS_HEADER_KEY
} from '../../../distributedTracing/distributedTracingHeaders';
import { firstPartyHostsRegexMapBuilder } from '../../../distributedTracing/firstPartyHosts';
import {
    DATADOG_GRAPH_QL_OPERATION_NAME_HEADER,
    DATADOG_GRAPH_QL_OPERATION_TYPE_HEADER,
    DATADOG_GRAPH_QL_VARIABLES_HEADER
} from '../../../graphql/graphqlHeaders';
import { ResourceReporter } from '../DatadogRumResource/ResourceReporter';
import { XHRProxy } from '../XHRProxy';
import {
    calculateResponseSize,
    RESOURCE_SIZE_ERROR_MESSAGE
} from '../responseSize';

jest.useFakeTimers();
jest.mock('../../../../../../InternalLog');
const mockedInternalLog = (InternalLog as unknown) as {
    log: jest.MockedFunction<typeof InternalLog.log>;
};
jest.spyOn(global.Math, 'random');

const DdNativeRum = NativeModules.DdRum;

function randomInt(max: number): number {
    return Math.floor(Math.random() * max);
}

const flushPromises = () =>
    new Promise(jest.requireActual('timers').setImmediate);
let xhrProxy;

const hexToDecimal = (hex: string): string => {
    return BigInt(hex, 16).toString(10);
};

beforeEach(() => {
    DdNativeRum.startResource.mockClear();
    DdNativeRum.stopResource.mockClear();
    BufferSingleton.onInitialization();

    xhrProxy = new XHRProxy({
        xhrType: XMLHttpRequestMock,
        resourceReporter: new ResourceReporter([])
    });

    // we need this because with ms precision between Date.now() calls we can get 0, so we advance
    // it manually with each call
    let now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => {
        now += 5;
        return now;
    });

    jest.setTimeout(20000);
});

afterEach(() => {
    xhrProxy.onTrackingStop();
    (Date.now as jest.MockedFunction<typeof Date.now>).mockClear();
    jest.spyOn(global.Math, 'random').mockRestore();
    DdRum.unregisterResourceEventMapper();
});

describe('XHRProxy', () => {
    describe('resource interception', () => {
        it('intercepts XHR request when startTracking() + XHR.open() + XHR.send()', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com:443/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(DdNativeRum.startResource.mock.calls.length).toBe(1);
            expect(DdNativeRum.startResource.mock.calls[0][1]).toBe(method);
            expect(DdNativeRum.startResource.mock.calls[0][2]).toBe(url);

            expect(DdNativeRum.stopResource.mock.calls.length).toBe(1);
            expect(DdNativeRum.stopResource.mock.calls[0][0]).toBe(
                DdNativeRum.startResource.mock.calls[0][0]
            );
            expect(DdNativeRum.stopResource.mock.calls[0][1]).toBe(200);
            expect(DdNativeRum.stopResource.mock.calls[0][2]).toBe('xhr');
            expect(DdNativeRum.stopResource.mock.calls[0][3]).toBeGreaterThan(
                0
            );

            expect(xhr.originalOpenCalled).toBe(true);
            expect(xhr.originalSendCalled).toBe(true);
            expect(xhr.originalOnReadyStateChangeCalled).toBe(true);
        });

        it('intercepts failing XHR request when startTracking() + XHR.open() + XHR.send()', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(500, 'error');
            await flushPromises();

            // THEN
            expect(DdNativeRum.startResource.mock.calls.length).toBe(1);
            expect(DdNativeRum.startResource.mock.calls[0][1]).toBe(method);
            expect(DdNativeRum.startResource.mock.calls[0][2]).toBe(url);

            expect(DdNativeRum.stopResource.mock.calls.length).toBe(1);
            expect(DdNativeRum.stopResource.mock.calls[0][0]).toBe(
                DdNativeRum.startResource.mock.calls[0][0]
            );
            expect(DdNativeRum.stopResource.mock.calls[0][1]).toBe(500);
            expect(DdNativeRum.stopResource.mock.calls[0][2]).toBe('xhr');
            expect(DdNativeRum.stopResource.mock.calls[0][3]).toBeGreaterThan(
                0
            );

            expect(xhr.originalOpenCalled).toBe(true);
            expect(xhr.originalSendCalled).toBe(true);
            expect(xhr.originalOnReadyStateChangeCalled).toBe(true);
        });

        it('intercepts aborted XHR request when startTracking() + XHR.open() + XHR.send() + XHR.abort()', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.abort();
            xhr.complete(0, undefined);
            await flushPromises();

            // THEN
            expect(DdNativeRum.startResource.mock.calls.length).toBe(1);
            expect(DdNativeRum.startResource.mock.calls[0][1]).toBe(method);
            expect(DdNativeRum.startResource.mock.calls[0][2]).toBe(url);

            expect(DdNativeRum.stopResource.mock.calls.length).toBe(1);
            expect(DdNativeRum.stopResource.mock.calls[0][0]).toBe(
                DdNativeRum.startResource.mock.calls[0][0]
            );
            expect(DdNativeRum.stopResource.mock.calls[0][1]).toBe(0);
            expect(DdNativeRum.stopResource.mock.calls[0][2]).toBe('xhr');
            expect(DdNativeRum.stopResource.mock.calls[0][3]).toBe(-1);

            expect(xhr.originalOpenCalled).toBe(true);
            expect(xhr.originalSendCalled).toBe(true);
            expect(xhr.originalOnReadyStateChangeCalled).toBe(true);
        });
    });

    describe('request headers', () => {
        it('adds the span id and trace Id in the request headers when startTracking() + XHR.open() + XHR.send()', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'api.example.com',
                        propagatorTypes: [PropagatorType.DATADOG]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            const spanId = xhr.requestHeaders[PARENT_ID_HEADER_KEY];
            expect(spanId).toBeDefined();
            expect(spanId).toMatch(/[1-9].+/);
            const traceId = xhr.requestHeaders[TRACE_ID_HEADER_KEY];
            expect(traceId).toBeDefined();
            expect(traceId).toMatch(/[1-9].+/);

            expect(traceId !== spanId).toBeTruthy();

            expect(xhr.requestHeaders[SAMPLING_PRIORITY_HEADER_KEY]).toBe('1');
            expect(xhr.requestHeaders[ORIGIN_HEADER_KEY]).toBe(ORIGIN_RUM);
        });

        it('does not generate spanId and traceId in request headers when no first party hosts are provided', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(xhr.requestHeaders[TRACE_ID_HEADER_KEY]).toBeUndefined();
            expect(xhr.requestHeaders[PARENT_ID_HEADER_KEY]).toBeUndefined();
        });

        it('does not generate spanId and traceId in request headers when the url does not match first party hosts', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'google.com',
                        propagatorTypes: [PropagatorType.DATADOG]
                    },
                    {
                        match: 'api.example.co',
                        propagatorTypes: [PropagatorType.DATADOG]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(xhr.requestHeaders[TRACE_ID_HEADER_KEY]).toBeUndefined();
            expect(xhr.requestHeaders[PARENT_ID_HEADER_KEY]).toBeUndefined();
        });

        it('does not crash when provided URL is not a valid one', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'crash';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.DATADOG]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(xhr.requestHeaders[TRACE_ID_HEADER_KEY]).toBeUndefined();
            expect(xhr.requestHeaders[PARENT_ID_HEADER_KEY]).toBeUndefined();
        });

        it('generates spanId and traceId with 0 sampling priority in request headers when trace is not sampled', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 0,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'api.example.com',
                        propagatorTypes: [PropagatorType.DATADOG]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(xhr.requestHeaders[TRACE_ID_HEADER_KEY]).not.toBeUndefined();
            expect(
                xhr.requestHeaders[PARENT_ID_HEADER_KEY]
            ).not.toBeUndefined();
            expect(xhr.requestHeaders[SAMPLING_PRIORITY_HEADER_KEY]).toBe('0');
            expect(xhr.requestHeaders[ORIGIN_HEADER_KEY]).toBe(ORIGIN_RUM);
        });

        it('does not origin as RUM in the request headers when startTracking() + XHR.open() + XHR.send()', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(xhr.requestHeaders[ORIGIN_HEADER_KEY]).toBeUndefined();
        });

        it('forces the agent to keep the request generated trace when startTracking() + XHR.open() + XHR.send()', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'api.example.com',
                        propagatorTypes: [PropagatorType.DATADOG]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(xhr.requestHeaders[SAMPLING_PRIORITY_HEADER_KEY]).toBe('1');
        });

        it('forces the agent to discard the request generated trace when startTracking when the request is not traced', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 0,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'api.example.com',
                        propagatorTypes: [PropagatorType.DATADOG]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(xhr.requestHeaders[SAMPLING_PRIORITY_HEADER_KEY]).toBe('0');
        });

        it('adds tracecontext request headers when the host is instrumented with tracecontext and request is sampled', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com:443/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'something.fr',
                        propagatorTypes: [PropagatorType.DATADOG]
                    },
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.TRACECONTEXT]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            const contextHeader = xhr.requestHeaders[TRACECONTEXT_HEADER_KEY];
            expect(contextHeader).toMatch(
                /^00-[0-9a-f]{8}[0]{8}[0-9a-f]{16}-[0-9a-f]{16}-01$/
            );

            // Parent value of the context header is the 3rd part of it
            const parentValue = contextHeader.split('-')[2];
            const stateHeader = xhr.requestHeaders[TRACESTATE_HEADER_KEY];
            expect(stateHeader).toBe(`dd=s:1;o:rum;p:${parentValue}`);
        });

        it('adds correct trace IDs headers for all propagatorTypes', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com:443/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.DATADOG]
                    },
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.TRACECONTEXT]
                    },
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.B3]
                    },
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.B3MULTI]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN

            /* =================================================================================
             *  Verify that the trace id in the traceparent header is a 128 bit trace ID (hex).
             * ================================================================================= */
            const traceparentHeader =
                xhr.requestHeaders[TRACECONTEXT_HEADER_KEY];
            const traceparentTraceId = traceparentHeader.split('-')[1];

            expect(traceparentTraceId).toMatch(
                /^[0-9a-f]{8}[0]{8}[0-9a-f]{16}$/
            );
            expect(
                TracingIdentifierUtils.isWithin128Bits(traceparentTraceId, 16)
            );

            /* =========================================================================
             *  Verify that the trace id in the x-datadog-trace-id is a 64 bit decimal.
             * ========================================================================= */

            // x-datadog-trace-id is a decimal representing the low 64 bits of the 128 bits Trace ID
            const xDatadogTraceId = xhr.requestHeaders[TRACE_ID_HEADER_KEY];

            expect(TracingIdentifierUtils.isWithin64Bits(xDatadogTraceId));

            /* ===============================================================
             *  Verify that the trace id in x-datadog-tags headers is HEX 16.
             * =============================================================== */

            // x-datadog-tags is a HEX 16 contains the high 64 bits of the 128 bits Trace ID
            const xDatadogTagsTraceId = xhr.requestHeaders[
                TAGS_HEADER_KEY
            ].split('=')[1];

            expect(xDatadogTagsTraceId).toMatch(/^[a-f0-9]{16}$/);
            expect(
                TracingIdentifierUtils.isWithin64Bits(xDatadogTagsTraceId, 16)
            );

            /* =========================================================================
             *  Verify that the trace id in the b3 header is a 128 bit trace ID (hex).
             * ========================================================================= */

            const b3Header = xhr.requestHeaders[B3_HEADER_KEY];
            const b3TraceId = b3Header.split('-')[0];

            expect(b3TraceId).toMatch(/^[0-9a-f]{8}[0]{8}[0-9a-f]{16}$/);
            expect(TracingIdentifierUtils.isWithin128Bits(b3TraceId, 16));

            /* =================================================================================
             *  Verify that the trace id in the X-B3-TraceId header is a 128 bit trace ID (hex).
             * ================================================================================= */

            const xB3TraceId = xhr.requestHeaders[B3_MULTI_TRACE_ID_HEADER_KEY];

            expect(xB3TraceId).toMatch(/^[0-9a-f]{8}[0]{8}[0-9a-f]{16}$/);
            expect(TracingIdentifierUtils.isWithin128Bits(xB3TraceId, 16));
        });

        it('adds tracing headers with matching value when all headers are added', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com:443/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.DATADOG]
                    },
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.TRACECONTEXT]
                    },
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.B3]
                    },
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.B3MULTI]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN

            // x-datadog-trace-id is just the low 64 bits (DECIMAL)
            const datadogLowTraceValue =
                xhr.requestHeaders[TRACE_ID_HEADER_KEY];

            // We convert the low 64 bits to HEX
            const datadogLowTraceValueHex = `${BigInt(datadogLowTraceValue)
                .toString(16)
                .padStart(16, '0')}`;

            // The high 64 bits are expressed in x-datadog-tags (HEX)
            const datadogHighTraceValueHex = xhr.requestHeaders[
                TAGS_HEADER_KEY
            ].split('=')[1]; // High HEX 64 bits

            // We re-compose the full 128 bit trace-id by joining the strings
            const datadogTraceValue128BitHex = `${datadogHighTraceValueHex}${datadogLowTraceValueHex}`;

            // We then get the decimal value of the trace-id
            const datadogTraceValue128BitDec = hexToDecimal(
                datadogTraceValue128BitHex
            );

            const datadogParentValue = xhr.requestHeaders[PARENT_ID_HEADER_KEY];
            const contextHeader = xhr.requestHeaders[TRACECONTEXT_HEADER_KEY];
            const traceContextValue = contextHeader.split('-')[1];
            const parentContextValue = contextHeader.split('-')[2];
            const b3MultiTraceHeader =
                xhr.requestHeaders[B3_MULTI_TRACE_ID_HEADER_KEY];
            const b3MultiParentHeader =
                xhr.requestHeaders[B3_MULTI_SPAN_ID_HEADER_KEY];

            const b3Header = xhr.requestHeaders[B3_HEADER_KEY];
            const traceB3Value = b3Header.split('-')[0];
            const parentB3Value = b3Header.split('-')[1];

            expect(hexToDecimal(traceContextValue)).toBe(
                datadogTraceValue128BitDec
            );
            expect(hexToDecimal(parentContextValue)).toBe(datadogParentValue);
            //
            expect(hexToDecimal(b3MultiTraceHeader)).toBe(
                datadogTraceValue128BitDec
            );
            expect(hexToDecimal(b3MultiParentHeader)).toBe(datadogParentValue);

            expect(hexToDecimal(traceB3Value)).toBe(datadogTraceValue128BitDec);
            expect(hexToDecimal(parentB3Value)).toBe(datadogParentValue);
        });

        it('adds tracecontext request headers when the host is instrumented with tracecontext and request is sampled', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com:443/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'something.fr',
                        propagatorTypes: [PropagatorType.DATADOG]
                    },
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.B3MULTI]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            const traceId = xhr.requestHeaders[B3_MULTI_TRACE_ID_HEADER_KEY];
            const spanId = xhr.requestHeaders[B3_MULTI_SPAN_ID_HEADER_KEY];
            const sampled = xhr.requestHeaders[B3_MULTI_SAMPLED_HEADER_KEY];
            expect(traceId).toMatch(/^[0-9a-f]{8}[0]{8}[0-9a-f]{16}$/);
            expect(spanId).toMatch(/^[0-9a-f]{16}$/);
            expect(sampled).toBe('1');
        });

        it('adds tracecontext request headers when the host is instrumented with b3 and request is sampled', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com:443/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'something.fr',
                        propagatorTypes: [PropagatorType.DATADOG]
                    },
                    {
                        match: 'example.com',
                        propagatorTypes: [PropagatorType.B3]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            const headerValue = xhr.requestHeaders[B3_HEADER_KEY];
            expect(headerValue).toMatch(
                /^[0-9a-f]{8}[0]{8}[0-9a-f]{16}-[0-9a-f]{16}-1$/
            );
        });

        it('adds all headers when the host is matched for different propagators', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com:443/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'api.example.com',
                        propagatorTypes: [
                            PropagatorType.DATADOG,
                            PropagatorType.TRACECONTEXT
                        ]
                    },
                    {
                        match: 'example.com',
                        propagatorTypes: [
                            PropagatorType.B3,
                            PropagatorType.B3MULTI
                        ]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(xhr.requestHeaders[B3_HEADER_KEY]).not.toBeUndefined();
            expect(
                xhr.requestHeaders[B3_MULTI_TRACE_ID_HEADER_KEY]
            ).not.toBeUndefined();
            expect(
                xhr.requestHeaders[B3_MULTI_SPAN_ID_HEADER_KEY]
            ).not.toBeUndefined();
            expect(xhr.requestHeaders[B3_MULTI_SAMPLED_HEADER_KEY]).toBe('1');
            expect(
                xhr.requestHeaders[TRACECONTEXT_HEADER_KEY]
            ).not.toBeUndefined();
            expect(xhr.requestHeaders[TRACE_ID_HEADER_KEY]).not.toBeUndefined();
            expect(
                xhr.requestHeaders[PARENT_ID_HEADER_KEY]
            ).not.toBeUndefined();
            expect(xhr.requestHeaders[SAMPLING_PRIORITY_HEADER_KEY]).toBe('1');
            expect(xhr.requestHeaders[ORIGIN_HEADER_KEY]).toBe(ORIGIN_RUM);
        });
    });

    describe('DdRum.startResource calls', () => {
        it('adds the span id, trace id and rule_psr as resource attributes when startTracking() + XHR.open() + XHR.send()', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'api.example.com',
                        propagatorTypes: [PropagatorType.DATADOG]
                    }
                ])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            const spanId =
                DdNativeRum.startResource.mock.calls[0][3]['_dd.span_id'];
            expect(spanId).toBeDefined();
            expect(spanId).toMatch(/[1-9].+/);

            const traceId =
                DdNativeRum.startResource.mock.calls[0][3]['_dd.trace_id'];
            expect(traceId).toBeDefined();
            expect(traceId).toMatch(/[1-9].+/);

            const rulePsr =
                DdNativeRum.startResource.mock.calls[0][3]['_dd.rule_psr'];
            expect(rulePsr).toBe(1);

            // Check traceId and spanId are different
            expect(traceId).not.toBe(spanId);
        });

        it('does not generate spanId and traceId when tracing is disabled', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 50,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(DdNativeRum.startResource).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    '_dd.trace_id': expect.any(String),
                    '_dd.span_id': expect.any(String),
                    '_dd.rule_psr': expect.any(Number)
                }),
                expect.anything()
            );
            expect(DdNativeRum.startResource.mock.calls[0][3]).toStrictEqual(
                {}
            );
        });

        it('generates spanId and traceId when the trace is not sampled', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 0,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([
                    {
                        match: 'api.example.com',
                        propagatorTypes: [PropagatorType.DATADOG]
                    }
                ])
            });
            jest.spyOn(global.Math, 'random').mockReturnValue(0.7);

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.notifyResponseArrived();
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            expect(DdNativeRum.startResource).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                expect.objectContaining({
                    '_dd.trace_id': expect.any(String),
                    '_dd.span_id': expect.any(String),
                    '_dd.rule_psr': expect.any(Number)
                }),
                expect.anything()
            );
            expect(DdNativeRum.startResource.mock.calls[0][3]).toStrictEqual(
                {}
            );
        });
    });

    describe.each([['android'], ['ios']])('timings test', platform => {
        it(`M generate resource timings when startTracking() + XHR.open() + XHR.send(), platform=${platform}`, async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            jest.doMock('react-native/Libraries/Utilities/Platform', () => ({
                OS: platform
            }));

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            jest.advanceTimersByTime(50);
            xhr.notifyResponseArrived();
            jest.advanceTimersByTime(50);
            xhr.complete(200, 'ok');
            await flushPromises();

            // THEN
            const timings =
                DdNativeRum.stopResource.mock.calls[0][4][
                    '_dd.resource_timings'
                ];

            if (Platform.OS === 'ios') {
                expect(timings['firstByte']['startTime']).toBeGreaterThan(0);
            } else {
                expect(timings['firstByte']['startTime']).toBe(0);
            }
            expect(timings['firstByte']['duration']).toBeGreaterThan(0);

            expect(timings['download']['startTime']).toBeGreaterThan(0);
            expect(timings['download']['duration']).toBeGreaterThan(0);

            if (Platform.OS === 'ios') {
                expect(timings['fetch']['startTime']).toBeGreaterThan(0);
            } else {
                expect(timings['fetch']['startTime']).toBe(0);
            }
            expect(timings['fetch']['duration']).toBeGreaterThan(0);
        });

        it(`M generate resource timings when startTracking() + XHR.open() + XHR.send() + XHR.abort(), platform=${platform}`, async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            jest.doMock('react-native/Libraries/Utilities/Platform', () => ({
                OS: platform
            }));

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            jest.advanceTimersByTime(50);
            xhr.notifyResponseArrived();
            jest.advanceTimersByTime(50);
            xhr.abort();
            xhr.complete(0, undefined);
            await flushPromises();

            // THEN
            const timings =
                DdNativeRum.stopResource.mock.calls[0][4][
                    '_dd.resource_timings'
                ];

            if (Platform.OS === 'ios') {
                expect(timings['firstByte']['startTime']).toBeGreaterThan(0);
            } else {
                expect(timings['firstByte']['startTime']).toBe(0);
            }
            expect(timings['firstByte']['duration']).toBeGreaterThan(0);

            expect(timings['download']['startTime']).toBeGreaterThan(0);
            expect(timings['download']['duration']).toBeGreaterThan(0);

            if (Platform.OS === 'ios') {
                expect(timings['fetch']['startTime']).toBeGreaterThan(0);
            } else {
                expect(timings['fetch']['startTime']).toBe(0);
            }
            expect(timings['fetch']['duration']).toBeGreaterThan(0);
        });
    });

    describe('DdRum.stopResource calls', () => {
        it('does not generate resource timings when startTracking() + XHR.open() + XHR.send() + XHR.abort() before load started', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.abort();
            xhr.complete(0, undefined);
            await flushPromises();

            // THEN
            const attributes = DdNativeRum.stopResource.mock.calls[0][4];

            expect(attributes['_dd.resource_timings']).toBeUndefined();
        });

        it('attaches the XMLHttpRequest object containing response to the event mapper', async () => {
            // GIVEN
            const method = 'GET';
            const url = 'https://api.example.com/v2/user';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });
            DdRum.registerResourceEventMapper(event => {
                event.context['body'] = JSON.parse(
                    event.resourceContext?.response
                );
                return event;
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.send();
            xhr.abort();
            xhr.complete(200, JSON.stringify({ body: 'content' }));
            await flushPromises();

            // THEN
            const attributes = DdNativeRum.stopResource.mock.calls[0][4];

            expect(attributes['body']).toEqual({
                body: 'content'
            });
        });
    });

    describe.each(
        ([
            'blob',
            'arraybuffer',
            'text',
            '',
            'json'
        ] as XMLHttpRequestResponseType[]).map(responseType => {
            const xhr = new XMLHttpRequestMock();
            xhr.readyState = XMLHttpRequestMock.DONE;
            xhr.responseType = responseType;
            xhr.response = {};

            const contentLength = randomInt(1_000_000_000);
            xhr.setResponseHeader('Content-Length', contentLength.toString());
            return {
                xhr,
                responseType: responseType || '_empty_',
                expectedSize: contentLength
            };
        })
    )(
        'Response size from response header',
        ({ xhr, responseType, expectedSize }) => {
            it(`M calculate response size when calculateResponseSize(), responseType=${responseType}`, () => {
                // WHEN
                const size = calculateResponseSize(
                    (xhr as unknown) as XMLHttpRequest
                );

                // THEN
                expect(size).toEqual(expectedSize);
            });
        }
    );

    describe('response size calculation', () => {
        it('calculates response size when calculateResponseSize() { responseType=blob }', () => {
            // GIVEN
            const xhr = new XMLHttpRequestMock();
            xhr.readyState = XMLHttpRequestMock.DONE;
            xhr.responseType = 'blob';

            const expectedSize = randomInt(1_000_000);
            xhr.response = {
                get size() {
                    return expectedSize;
                }
            };

            // WHEN
            const size = calculateResponseSize(
                (xhr as unknown) as XMLHttpRequest
            );

            // THEN
            expect(size).toEqual(expectedSize);
        });

        it('calculates response size when calculateResponseSize() { responseType=arraybuffer }', () => {
            // GIVEN
            const xhr = new XMLHttpRequestMock();
            xhr.readyState = XMLHttpRequestMock.DONE;
            xhr.responseType = 'arraybuffer';

            const expectedSize = randomInt(100_000);
            xhr.response = new ArrayBuffer(expectedSize);

            // WHEN
            const size = calculateResponseSize(
                (xhr as unknown) as XMLHttpRequest
            );

            // THEN
            expect(size).toEqual(expectedSize);
        });

        it('calculates response size when calculateResponseSize() { responseType=text }', () => {
            // GIVEN
            const xhr = new XMLHttpRequestMock();
            xhr.readyState = XMLHttpRequestMock.DONE;
            xhr.responseType = 'text';

            // size per char is 24, but in bytes it is 33.
            const expectedSize = 33;
            xhr.response = '{"foo": "bar+úñïçôδè ℓ"}';

            // WHEN
            const size = calculateResponseSize(
                (xhr as unknown) as XMLHttpRequest
            );

            // THEN
            expect(size).toEqual(expectedSize);
        });

        it('calculates response size when calculateResponseSize() { responseType=_empty_ }', () => {
            // GIVEN
            const xhr = new XMLHttpRequestMock();
            xhr.readyState = XMLHttpRequestMock.DONE;
            xhr.responseType = '';

            // size per char is 24, but in bytes it is 33.
            const expectedSize = 33;
            xhr.response = '{"foo": "bar+úñïçôδè ℓ"}';

            // WHEN
            const size = calculateResponseSize(
                (xhr as unknown) as XMLHttpRequest
            );

            // THEN
            expect(size).toEqual(expectedSize);
        });

        it('calculates response size when calculateResponseSize() { responseType=json }', () => {
            // GIVEN
            const xhr = new XMLHttpRequestMock();
            xhr.readyState = XMLHttpRequestMock.DONE;
            xhr.responseType = 'json';

            const expectedSize = 24;
            xhr.response = { foo: { bar: 'foobar' } };

            // WHEN
            const size = calculateResponseSize(
                (xhr as unknown) as XMLHttpRequest
            );

            // THEN
            expect(size).toEqual(expectedSize);
        });

        it('does not calculate response size when calculateResponseSize() { responseType=document }', () => {
            // GIVEN
            const xhr = new XMLHttpRequestMock();
            xhr.readyState = XMLHttpRequestMock.DONE;
            // document type is not supported by RN, so there are no classes to handle it
            xhr.responseType = 'document';
            xhr.response = {};

            // WHEN
            const size = calculateResponseSize(
                (xhr as unknown) as XMLHttpRequest
            );

            // THEN
            expect(size).toEqual(-1);
        });

        it('returns 0 when calculateResponseSize() { error is thrown }', () => {
            // GIVEN
            mockedInternalLog.log.mockClear();

            const xhr = new XMLHttpRequestMock();
            xhr.readyState = XMLHttpRequestMock.DONE;
            xhr.responseType = 'blob';
            const error = new Error();
            xhr.response = {
                get size() {
                    throw error;
                }
            };

            // WHEN
            const size = calculateResponseSize(
                (xhr as unknown) as XMLHttpRequest
            );

            // THEN
            expect(size).toEqual(-1);
            expect(InternalLog.log).toHaveBeenCalledTimes(1);
            expect(InternalLog.log).toHaveBeenCalledWith(
                `${RESOURCE_SIZE_ERROR_MESSAGE}${error}`,
                SdkVerbosity.ERROR
            );
        });

        it('returns 0 when calculateResponseSize() { size is not a number }', () => {
            // GIVEN
            const xhr = new XMLHttpRequestMock();
            xhr.readyState = XMLHttpRequestMock.DONE;
            xhr.responseType = 'blob';

            // we pass empty object, so that .size property is missing, we will get undefined
            xhr.response = {};

            // WHEN
            const size = calculateResponseSize(
                (xhr as unknown) as XMLHttpRequest
            );

            // THEN
            expect(size).toEqual(-1);
        });

        it('returns 0 when calculateResponseSize() { no response }', () => {
            // GIVEN
            const xhr = new XMLHttpRequestMock();
            xhr.readyState = XMLHttpRequestMock.DONE;
            xhr.responseType = 'blob';
            xhr.response = null;

            // WHEN
            const size = calculateResponseSize(
                (xhr as unknown) as XMLHttpRequest
            );

            // THEN
            expect(size).toEqual(-1);
        });
    });

    describe('setRequestHeader', () => {
        it('sets graphql attributes and drops corresponding headers', async () => {
            // GIVEN
            const method = 'POST';
            const url = 'https://api.example.com/graphql';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.setRequestHeader(
                DATADOG_GRAPH_QL_OPERATION_TYPE_HEADER,
                'query'
            );
            xhr.setRequestHeader(
                DATADOG_GRAPH_QL_OPERATION_NAME_HEADER,
                'cats'
            );
            xhr.setRequestHeader(DATADOG_GRAPH_QL_VARIABLES_HEADER, '{}');
            xhr.send();
            xhr.abort();
            xhr.complete(0, undefined);
            await flushPromises();

            // THEN
            const attributes = DdNativeRum.stopResource.mock.calls[0][4];
            expect(attributes['_dd.graphql.operation_type']).toEqual('query');
            expect(attributes['_dd.graphql.operation_name']).toEqual('cats');
            expect(attributes['_dd.graphql.variables']).toEqual('{}');

            expect(
                xhr.requestHeaders[DATADOG_GRAPH_QL_OPERATION_TYPE_HEADER]
            ).not.toBeDefined();
            expect(
                xhr.requestHeaders[DATADOG_GRAPH_QL_OPERATION_NAME_HEADER]
            ).not.toBeDefined();
            expect(
                xhr.requestHeaders[DATADOG_GRAPH_QL_VARIABLES_HEADER]
            ).not.toBeDefined();
        });

        it('sets graphql attributes and drops corresponding headers when operation name and variables are missing', async () => {
            // GIVEN
            const method = 'POST';
            const url = 'https://api.example.com/graphql';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.setRequestHeader(
                DATADOG_GRAPH_QL_OPERATION_TYPE_HEADER,
                'query'
            );
            xhr.send();
            xhr.abort();
            xhr.complete(0, undefined);
            await flushPromises();

            // THEN
            const attributes = DdNativeRum.stopResource.mock.calls[0][4];
            expect(attributes['_dd.graphql.operation_type']).toEqual('query');
            expect(attributes['_dd.graphql.operation_name']).not.toBeDefined();
            expect(attributes['_dd.graphql.variables']).not.toBeDefined();

            expect(
                xhr.requestHeaders[DATADOG_GRAPH_QL_OPERATION_TYPE_HEADER]
            ).not.toBeDefined();
            expect(
                xhr.requestHeaders[DATADOG_GRAPH_QL_OPERATION_NAME_HEADER]
            ).not.toBeDefined();
            expect(
                xhr.requestHeaders[DATADOG_GRAPH_QL_VARIABLES_HEADER]
            ).not.toBeDefined();
        });

        it('does not set graphql attributes but drops corresponding headers when operation type is missing', async () => {
            // GIVEN
            const method = 'POST';
            const url = 'https://api.example.com/graphql';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.setRequestHeader(
                DATADOG_GRAPH_QL_OPERATION_NAME_HEADER,
                'cats'
            );
            xhr.setRequestHeader(DATADOG_GRAPH_QL_VARIABLES_HEADER, '{}');
            xhr.send();
            xhr.abort();
            xhr.complete(0, undefined);
            await flushPromises();

            // THEN
            const attributes = DdNativeRum.stopResource.mock.calls[0][4];
            expect(attributes['_dd.graphql.operation_type']).not.toBeDefined();
            expect(attributes['_dd.graphql.operation_name']).not.toBeDefined();
            expect(attributes['_dd.graphql.variables']).not.toBeDefined();

            expect(
                xhr.requestHeaders[DATADOG_GRAPH_QL_OPERATION_TYPE_HEADER]
            ).not.toBeDefined();
            expect(
                xhr.requestHeaders[DATADOG_GRAPH_QL_OPERATION_NAME_HEADER]
            ).not.toBeDefined();
            expect(
                xhr.requestHeaders[DATADOG_GRAPH_QL_VARIABLES_HEADER]
            ).not.toBeDefined();
        });

        it('enables mapper to edit graphql variables to remove sensitive information', async () => {
            // GIVEN
            const method = 'POST';
            const url = 'https://api.example.com/graphql';
            xhrProxy.onTrackingStart({
                tracingSamplingRate: 100,
                firstPartyHostsRegexMap: firstPartyHostsRegexMapBuilder([])
            });
            DdRum.registerResourceEventMapper(event => {
                if (event.context['_dd.graphql.variables']) {
                    const variables = JSON.parse(
                        event.context['_dd.graphql.variables']
                    );
                    if (variables.password) {
                        variables.password = '***';
                    }
                    event.context['_dd.graphql.variables'] = JSON.stringify(
                        variables
                    );
                }

                return event;
            });

            // WHEN
            const xhr = new XMLHttpRequestMock();
            xhr.open(method, url);
            xhr.setRequestHeader(
                DATADOG_GRAPH_QL_OPERATION_TYPE_HEADER,
                'query'
            );
            xhr.setRequestHeader(
                DATADOG_GRAPH_QL_VARIABLES_HEADER,
                JSON.stringify({ password: 'SECRET' })
            );
            xhr.send();
            xhr.abort();
            xhr.complete(0, undefined);
            await flushPromises();

            // THEN
            const attributes = DdNativeRum.stopResource.mock.calls[0][4];
            expect(attributes['_dd.graphql.operation_type']).toBe('query');
            expect(attributes['_dd.graphql.operation_name']).not.toBeDefined();
            expect(attributes['_dd.graphql.variables']).toBe(
                '{"password":"***"}'
            );
        });
    });
});
