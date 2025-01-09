/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2016-Present Datadog, Inc.
 */

import { NativeModules } from 'react-native';

import {
    ImagePrivacyLevel,
    SessionReplay,
    SessionReplayPrivacy,
    TextAndInputPrivacyLevel,
    TouchPrivacyLevel
} from '../SessionReplay';

function getRandomEnumValue<
    T extends { [s: string]: T[keyof T] } | ArrayLike<T[keyof T]>
>(enumObj: T): T[keyof T] {
    const values = Object.values(enumObj) as T[keyof T][]; // Get all enum values
    const randomIndex = Math.floor(Math.random() * values.length); // Generate a random index
    return values[randomIndex]; // Return the random value
}

beforeEach(() => {
    NativeModules.DdSessionReplay.enable.mockClear();
});

describe('SessionReplay', () => {
    describe('enable', () => {
        it('calls native session replay with default configuration', () => {
            SessionReplay.enable();

            expect(NativeModules.DdSessionReplay.enable).toHaveBeenCalledWith(
                100,
                '',
                'MASK_ALL',
                'HIDE',
                'MASK_ALL',
                true
            );
        });

        it('calls native session replay with provided configuration { w defaultPrivacyLevel = ALLOW }', () => {
            SessionReplay.enable({
                replaySampleRate: 100,
                defaultPrivacyLevel: SessionReplayPrivacy.ALLOW,
                customEndpoint: 'https://session-replay.example.com'
            });

            expect(NativeModules.DdSessionReplay.enable).toHaveBeenCalledWith(
                100,
                'https://session-replay.example.com',
                'MASK_NONE',
                'SHOW',
                'MASK_SENSITIVE_INPUTS',
                true
            );
        });

        it('calls native session replay with provided configuration { w defaultPrivacyLevel = MASK }', () => {
            SessionReplay.enable({
                replaySampleRate: 100,
                defaultPrivacyLevel: SessionReplayPrivacy.MASK,
                customEndpoint: 'https://session-replay.example.com'
            });

            expect(NativeModules.DdSessionReplay.enable).toHaveBeenCalledWith(
                100,
                'https://session-replay.example.com',
                'MASK_ALL',
                'HIDE',
                'MASK_ALL',
                true
            );
        });

        it('calls native session replay with provided configuration { w defaultPrivacyLevel = MASK_USER_INPUT }', () => {
            SessionReplay.enable({
                replaySampleRate: 100,
                defaultPrivacyLevel: SessionReplayPrivacy.MASK_USER_INPUT,
                customEndpoint: 'https://session-replay.example.com'
            });

            expect(NativeModules.DdSessionReplay.enable).toHaveBeenCalledWith(
                100,
                'https://session-replay.example.com',
                'MASK_NONE',
                'HIDE',
                'MASK_ALL_INPUTS',
                true
            );
        });

        it('calls native session replay with provided configuration { w random privacy levels }', () => {
            const TIMES = 20;

            const image = getRandomEnumValue(ImagePrivacyLevel);
            const touch = getRandomEnumValue(TouchPrivacyLevel);
            const textAndInput = getRandomEnumValue(TextAndInputPrivacyLevel);

            for (let i = 0; i < TIMES; ++i) {
                SessionReplay.enable({
                    replaySampleRate: 100,
                    customEndpoint: 'https://session-replay.example.com',
                    imagePrivacyLevel: image,
                    touchPrivacyLevel: touch,
                    textAndInputPrivacyLevel: textAndInput
                });

                expect(
                    NativeModules.DdSessionReplay.enable
                ).toHaveBeenCalledWith(
                    100,
                    'https://session-replay.example.com',
                    image,
                    touch,
                    textAndInput,
                    true
                );
            }
        });

        it('calls native session replay with edge cases in configuration', () => {
            SessionReplay.enable({
                replaySampleRate: 0,
                customEndpoint: ''
            });

            expect(NativeModules.DdSessionReplay.enable).toHaveBeenCalledWith(
                0,
                '',
                'MASK_ALL',
                'HIDE',
                'MASK_ALL',
                true
            );
        });
    });
});
