// The sticker theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in sticker.settings.json and the generated sticker.settings.ts;
// change them with `astryx experimental theme editor set sticker ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {stickerSettings} from './sticker.settings';

export const stickerTheme = defineTheme({
  extends: stickerSettings,
  name: 'sticker',
});
