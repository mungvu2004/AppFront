/**
 * Năm phong cách cảnh Pascal (J6): mỗi phong cách là một bộ DỮ LIỆU — vật liệu sàn theo
 * `finish`, sơn tường, họ vật liệu đồ đạc, thư mục mô hình ưu tiên theo vai trò, ánh đèn.
 *
 * Chỉ là dữ liệu thuần, chưa nối vào `toPascal.ts`. Tham chiếu `library:<id>` chỉ dùng
 * những vật liệu đã có tệp (14 vân gỗ/gạch của J2 + concrete/fabric/leather/metal);
 * `scene:<id>` trỏ vào `SCENE_STYLE_MATERIALS` dưới đây hoặc `SCENE_MATERIALS` sẵn có.
 */

import type { RoomFinish } from '@/domain/spatial/types';

import { STYLE_PALETTE } from './scenePalette';
import type { FurnitureRole } from './sceneVariety';
import type { PascalSceneMaterial } from './types';

export type SceneStyleId = 'am-ap' | 'hien-dai-sang' | 'go-am' | 'toi-gian' | 'sang-trong-toi';

export const SCENE_STYLE_IDS: readonly SceneStyleId[] = ['am-ap', 'hien-dai-sang', 'go-am', 'toi-gian', 'sang-trong-toi'];

export const DEFAULT_SCENE_STYLE: SceneStyleId = 'am-ap';

export type SlotFamily = 'fabric' | 'wood' | 'metal' | 'cabinetry' | 'countertop' | 'ceramic' | 'rug' | 'pot';

export interface SceneStyle {
  readonly id: SceneStyleId;
  /** Tên hiển thị tiếng Việt. */
  readonly label: string;
  /** Tham chiếu vật liệu sàn theo `finish`. */
  readonly floor: Readonly<Record<RoomFinish, string>>;
  readonly wall: { readonly interior: string; readonly exterior: string };
  readonly families: Readonly<Record<SlotFamily, string>>;
  /** Thư mục catalog ưu tiên theo vai trò đồ đạc (`sceneVariety.ts`). */
  readonly prefer: Readonly<Partial<Record<FurnitureRole, readonly string[]>>>;
  readonly lampColour: string;
  readonly lampIntensity: number;
}

const flat = (name: string, label: string, color: string, roughness: number): PascalSceneMaterial => ({
  id: `mat_style_${name}`,
  name: label,
  material: {
    preset: 'custom',
    properties: { color, roughness, metalness: 0, opacity: 1, transparent: false, side: 'front' },
  },
});

/** Vật liệu phẳng mà các phong cách trỏ tới (`scene:mat_style_<name>`). */
export const SCENE_STYLE_MATERIALS: readonly PascalSceneMaterial[] = [
  flat('am_ap_wall', 'Sơn kem ấm', STYLE_PALETTE.amApWall, 0.9),
  flat('am_ap_exterior', 'Tường ngoài be', STYLE_PALETTE.amApExterior, 0.9),
  flat('am_ap_cabinet', 'Tủ gỗ sồi sơn', STYLE_PALETTE.amApCabinet, 0.6),
  flat('hien_dai_wall', 'Sơn trắng lạnh', STYLE_PALETTE.hienDaiWall, 0.85),
  flat('hien_dai_exterior', 'Tường ngoài xám sáng', STYLE_PALETTE.hienDaiExterior, 0.9),
  flat('hien_dai_cabinet', 'Tủ trắng bóng', STYLE_PALETTE.hienDaiCabinet, 0.3),
  flat('go_am_wall', 'Sơn be gỗ', STYLE_PALETTE.goAmWall, 0.9),
  flat('go_am_exterior', 'Tường ngoài nâu', STYLE_PALETTE.goAmExterior, 0.9),
  flat('go_am_cabinet', 'Tủ gỗ óc chó', STYLE_PALETTE.goAmCabinet, 0.55),
  flat('toi_gian_wall', 'Sơn xám trắng', STYLE_PALETTE.toiGianWall, 0.9),
  flat('toi_gian_exterior', 'Tường ngoài xám', STYLE_PALETTE.toiGianExterior, 0.9),
  flat('toi_gian_cabinet', 'Tủ xám mờ', STYLE_PALETTE.toiGianCabinet, 0.7),
  flat('sang_trong_wall', 'Sơn than chì', STYLE_PALETTE.sangTrongWall, 0.8),
  flat('sang_trong_exterior', 'Tường ngoài than', STYLE_PALETTE.sangTrongExterior, 0.9),
  flat('sang_trong_cabinet', 'Tủ đen mờ', STYLE_PALETTE.sangTrongCabinet, 0.5),
  flat('ceramic_white', 'Sứ trắng', STYLE_PALETTE.ceramicWhite, 0.15),
  flat('ceramic_ivory', 'Sứ ngà', STYLE_PALETTE.ceramicIvory, 0.2),
  flat('pot_terracotta', 'Chậu đất nung', STYLE_PALETTE.potTerracotta, 0.85),
  flat('pot_concrete', 'Chậu xi măng', STYLE_PALETTE.potConcrete, 0.9),
  flat('pot_black', 'Chậu đen', STYLE_PALETTE.potBlack, 0.6),
];

const lib = (id: string): string => `library:${id}`;
const scene = (name: string): string => `scene:mat_style_${name}`;

export const SCENE_STYLES: Readonly<Record<SceneStyleId, SceneStyle>> = {
  // Mặc định: gỗ tự nhiên, kem ấm, vải lanh, đồng thau.
  'am-ap': {
    id: 'am-ap',
    label: 'Ấm áp',
    floor: {
      wood: lib('wood-woodplank48'),
      tile: lib('flooring-tile79'),
      mosaic: lib('flooring-tile20'),
      decking: lib('wood-woodplank19'),
      concrete: lib('concrete-polished'),
    },
    wall: { interior: scene('am_ap_wall'), exterior: scene('am_ap_exterior') },
    families: {
      fabric: lib('fabric-linen'),
      wood: lib('wood-finewood27'),
      metal: lib('metal-brass'),
      cabinetry: scene('am_ap_cabinet'),
      countertop: lib('flooring-statuarettowhite'),
      ceramic: scene('ceramic_ivory'),
      rug: lib('fabric-wool'),
      pot: scene('pot_terracotta'),
    },
    prefer: { plant: ['indoor-plant'], roundRug: ['round-carpet'], desk: ['office-table'] },
    lampColour: STYLE_PALETTE.lampWarm,
    lampIntensity: 6,
  },
  // Sàn ván sáng, gạch men trắng, tường trắng lạnh, crôm.
  'hien-dai-sang': {
    id: 'hien-dai-sang',
    label: 'Hiện đại sáng',
    floor: {
      wood: lib('wood-floorplank1'),
      tile: lib('flooring-lightceramic24'),
      mosaic: lib('flooring-tiles4'),
      decking: lib('wood-woodplank19'),
      concrete: lib('concrete-polished'),
    },
    wall: { interior: scene('hien_dai_wall'), exterior: scene('hien_dai_exterior') },
    families: {
      fabric: lib('fabric-cotton'),
      wood: lib('wood-floorplank1'),
      metal: lib('metal-chrome'),
      cabinetry: scene('hien_dai_cabinet'),
      countertop: lib('flooring-statuarettowhite'),
      ceramic: scene('ceramic_white'),
      rug: lib('fabric-boucle'),
      pot: scene('pot_concrete'),
    },
    prefer: { plant: ['small-indoor-plant', 'indoor-plant'], rug: ['rectangular-carpet'] },
    lampColour: STYLE_PALETTE.lampNeutral,
    lampIntensity: 7,
  },
  // Gỗ đậm: sàn xương cá, tủ óc chó, nhung, đồng đỏ.
  'go-am': {
    id: 'go-am',
    label: 'Gỗ ấm',
    floor: {
      wood: lib('wood-hungarianparquet10'),
      tile: lib('flooring-tile79'),
      mosaic: lib('flooring-ceramic53'),
      decking: lib('wood-woodenparquet11'),
      concrete: lib('concrete-raw'),
    },
    wall: { interior: scene('go_am_wall'), exterior: scene('go_am_exterior') },
    families: {
      fabric: lib('fabric-velvet'),
      wood: lib('wood-hungarianparquet2'),
      metal: lib('metal-copper'),
      cabinetry: scene('go_am_cabinet'),
      countertop: lib('concrete-polished'),
      ceramic: scene('ceramic_ivory'),
      rug: lib('fabric-wool'),
      pot: scene('pot_terracotta'),
    },
    prefer: { plant: ['indoor-plant'], rug: ['rectangular-carpet'], desk: ['dining-table', 'office-table'] },
    lampColour: STYLE_PALETTE.lampAmber,
    lampIntensity: 5,
  },
  // Ít chi tiết: sàn gỗ ghép nhạt, xám trắng, bê tông, thép.
  'toi-gian': {
    id: 'toi-gian',
    label: 'Tối giản',
    floor: {
      wood: lib('flooring-woodparquet76'),
      tile: lib('flooring-tiles4'),
      mosaic: lib('flooring-lightceramic24'),
      decking: lib('wood-floorplank1'),
      concrete: lib('concrete-polished'),
    },
    wall: { interior: scene('toi_gian_wall'), exterior: scene('toi_gian_exterior') },
    families: {
      fabric: lib('fabric-boucle'),
      wood: lib('wood-woodenparquet11'),
      metal: lib('metal-steel'),
      cabinetry: scene('toi_gian_cabinet'),
      countertop: lib('concrete-polished'),
      ceramic: scene('ceramic_white'),
      rug: lib('fabric-linen'),
      pot: scene('pot_concrete'),
    },
    prefer: { plant: ['small-indoor-plant'], diningChair: ['stool', 'dining-chair'], roundRug: ['round-carpet'] },
    lampColour: STYLE_PALETTE.lampNeutral,
    lampIntensity: 6,
  },
  // Tường than chì, đá trắng, da đen, đồng thau bóng.
  'sang-trong-toi': {
    id: 'sang-trong-toi',
    label: 'Sang trọng tối',
    floor: {
      wood: lib('wood-hungarianparquet2'),
      tile: lib('flooring-statuarettowhite'),
      mosaic: lib('flooring-ceramic53'),
      decking: lib('wood-woodenparquet11'),
      concrete: lib('concrete-polished'),
    },
    wall: { interior: scene('sang_trong_wall'), exterior: scene('sang_trong_exterior') },
    families: {
      fabric: lib('leather-black'),
      wood: lib('wood-woodenparquet11'),
      metal: lib('metal-polished'),
      cabinetry: scene('sang_trong_cabinet'),
      countertop: lib('flooring-statuarettowhite'),
      ceramic: scene('ceramic_white'),
      rug: lib('fabric-velvet'),
      pot: scene('pot_black'),
    },
    prefer: { plant: ['indoor-plant'], roundRug: ['round-carpet'], desk: ['office-table'] },
    lampColour: STYLE_PALETTE.lampAmber,
    lampIntensity: 7,
  },
};

const isSceneStyleId = (id: unknown): id is SceneStyleId => SCENE_STYLE_IDS.includes(id as SceneStyleId);

/** Phong cách theo id; id lạ/thiếu → mặc định. */
export const sceneStyleOf = (id: unknown): SceneStyle => SCENE_STYLES[isSceneStyleId(id) ? id : DEFAULT_SCENE_STYLE];
