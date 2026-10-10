/// <reference types="react" />

// Tamagui type augmentation — explicitly register shorthands so TypeScript
// resolves f, bg, px etc. as valid View/Text props with correct value types.
import type { Conf, AppShorthands } from './tamagui.config';

declare module '@tamagui/web' {
  interface TamaguiCustomConfig extends Conf {
    shorthands: AppShorthands;
  }
}
declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends Conf {
    shorthands: AppShorthands;
  }
}
declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {
    shorthands: AppShorthands;
  }
}
