# Session Replay for React Native

Mobile Session Replay expands visibility into your mobile applications by visually replaying each user interaction, such as taps, swipes, and scrolls. Visually replaying user interactions on your applications makes it easier to reproduce crashes and errors, as well as understand the user journey for making UI improvements.

## Setup

**Note**: Make sure you’ve setup and initialized the [Datadog React Native SDK][1] with views instrumentation enabled.

To install with NPM, run:

```sh
npm install @datadog/mobile-react-native-session-replay
```

To install with Yarn, run:

```sh
yarn add @datadog/mobile-react-native-session-replay
```

## Enable Session Replay

To enable Session Replay, import and call the `enable` method with your configuration. Below is an example setup:

```js
import { SessionReplay } from "@datadog/mobile-react-native-session-replay";

SessionReplay.enable({
    replaySampleRate: sampleRate, // The percentage of sampled replays, in the range 0.0 - 100.0 (Default: 100.0).
    textAndInputPrivacyLevel: TextAndInputPrivacyLevel.MASK_ALL, // Defines the way text and input (e.g text fields, checkboxes) should be masked (Default: `MASK_ALL`).
    imagePrivacyLevel: ImagePrivacyLevel.MASK_ALL, // Defines the way images should be masked (Default: `MASK_ALL`).
    touchPrivacyLevel: TouchPrivacyLevel.HIDE  // Defines the way user touches (e.g tap) should be masked (Default: `HIDE`).
});
```

**Note**: All configuration properties are optional and should be adjusted based on your application's needs.

## Start or stop the recording manually

By default, Session Replay starts recording automatically. However, if you prefer to manually start recording at a specific point in your application, you can use the optional `startRecordingImmediately` parameter as shown below, and later call `SessionReplay.startRecording()`. You can also use `SessionReplay.stopRecording()` to stop the recording anytime.

```js
import { SessionReplay } from "@datadog/mobile-react-native-session-replay";

SessionReplay.enable({
  replaySampleRate: sampleRate,
  startRecordingImmediately: false
});
// Do something
SessionReplay.startRecording();
SessionReplay.stopRecording();
```

[1]: https://www.npmjs.com/package/@datadog/mobile-react-native