# TROUBLESHOOTING

### `Undefined symbol _RCTModule`

I had this issue when I run the project from Xcode. It might be related to this change in [`react-native v0.63 changelog`](https://github.com/facebook/react-native/commit/6e08f84719c47985e80123c72686d7a1c89b72ed)

We made the change below to fix it:

```
// DdSdk.m
// instead of
#import <React/RCTBridgeModule.h>
// maybe that:
@import React // or @import React-Core
```

### Infinite loop-like error messages

Sometimes, almost randomly, my RN project gives error messages non-stop.
CPU usage goes up to %+100 and you'll quickly notice a problem with your laptop fan goes crazy.

This is the issue: https://github.com/facebook/react-native/issues/28801

I tried some of the solutions, none worked. I solved the issue by creating a new RN project.