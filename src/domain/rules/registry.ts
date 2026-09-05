/**
 * What a spatial rule is, and where the rule book is kept.
 *
 * Rules run while a person is dragging a wall, so the whole design here is
 * shaped by two facts about that moment.
 *
 * The first is that **a rule must never touch the model**. A check that quietly
 * repaired what it found would move geometry under the cursor, and the drawing
 * would stop being the thing the user drew. Every rule is therefore a pure
 * function of a read-only view: it is handed indexes it cannot write to, it
 * returns findings, and that is the whole of its authority. Fixing is somebody
 * else's job, and it happens through `commit(patch, label)` with an undo.
 *
 * The second is that **the rule book has to grow without the runner changing**.
 * A rule declares the entity kinds it reads in `dependsOn`, and the registry
 * inverts that into a kind → rules map. The runner never names a rule, never
 * imports one, and never learns a new `if` when the book grows: it asks the
 * registry which rules a change touched and runs those. Adding a rule is
 * writing one object and registering it.
 *
 * Two conventions the interface depends on:
 *
 * - `code` is upper case (`WALL-THICKNESS`), because a rule code is an error
 *   code and those are the one thing allowed to shout on screen.
 * - `name`, `message` and `suggestion` are Vietnamese, lower case, sentence
 *   style. A finding names the entity code, says what is wrong in numbers a
 *   person can check on the drawing, and says what to do about it. All three
 *   are mandatory — a violation nobody can act on is noise.
 */

import {
  idsOnLevel,
  isEntityOfKind,
  type EntityByKind,
  type NormalizedSpatial,
} from '../spatial/normalize';
import type { LevelId, RoomUsage } from '../spatial/types';
import type { EntityKind } from '../spatial/ids';
import { MILLIMETRES_PER_METRE } from '../units/types';
import { formatArea, formatLength } from '../../lib/format/measure';
import { formatNumber } from '../../lib/format/number';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A rule code, upper case and hyphenated: `WALL-THICKNESS`, `ROOM-MIN-AREA`.
 *
 * Deliberately a plain `string` rather than a closed union: a union would have
 * to be edited every time a rule is added, which is exactly the coupling the
 * registry exists to remove.
 */
export type RuleCode = string;

/** How badly a broken rule hurts, worst first. */
export type RuleSeverity = 'critical' | 'warning' | 'suggestion';

/** Severities in the order a list of violations is sorted by. */
export const RULE_SEVERITIES: readonly RuleSeverity[] = ['critical', 'warning', 'suggestion'];

/** What the interface calls each severity. */
export const RULE_SEVERITY_LABELS: Readonly<Record<RuleSeverity, string>> = {
  critical: 'nghiêm trọng',
  warning: 'cảnh báo',
  suggestion: 'gợi ý',
};

/** The heading a rule is filed under in the rule list. */
export type RuleGroup = 'geometry' | 'circulation' | 'area' | 'annotation' | 'levels';

/** Groups in the order the interface shows them. */
export const RULE_GROUPS: readonly RuleGroup[] = [
  'geometry',
  'circulation',
  'area',
  'annotation',
  'levels',
];

/** What the interface calls each group. */
export const RULE_GROUP_LABELS: Readonly<Record<RuleGroup, string>> = {
  geometry: 'hình học',
  circulation: 'lưu thông',
  area: 'diện tích',
  annotation: 'ghi chú',
  levels: 'cao độ tầng',
};

/**
 * How much of the model one run of a rule looks at.
 *
 * `level` rules are checked once per level and see only that level, which is
 * what makes an edit re-check one floor instead of the building. `building`
 * rules are checked once and see everything; keep them few, because every edit
 * anywhere re-runs them whole.
 */
export type RuleScope = 'level' | 'building';

/** The kinds of entity a rule can depend on. */
export type RuleSubject = EntityKind;

/**
 * The read-only view a rule is given.
 *
 * `levelId` is the level under test for a `level` rule, and `null` for a
 * `building` one. Nothing in here can be written to: `graph` is the shared
 * normalized model, and a rule that mutated it would corrupt every other rule
 * running in the same pass.
 */
export interface RuleContext {
  readonly graph: NormalizedSpatial;
  readonly levelId: LevelId | null;
}

/**
 * One thing a rule found.
 *
 * The three fields are all required, on purpose. `entityId` is what the
 * interface selects and zooms to, `message` is what the person reads, and
 * `suggestion` is what they do next. A finding missing any of them cannot be
 * acted on, so the type refuses to describe one.
 */
export interface RuleFinding {
  /** Prefixed code of the entity at fault, e.g. `W-000012ABCD`. */
  readonly entityId: string;
  /** Vietnamese sentence naming the entity code and the numbers involved. */
  readonly message: string;
  /** Vietnamese sentence saying what to change. */
  readonly suggestion: string;
}

/** A finding, stamped with the rule and level it came from. */
export interface Violation extends RuleFinding {
  readonly ruleCode: RuleCode;
  readonly severity: RuleSeverity;
  /** The level the check ran on; `null` for a building-wide rule. */
  readonly levelId: LevelId | null;
}

/** The check itself: pure, read-only, same view in gives the same findings out. */
export type RuleCheck = (context: RuleContext) => readonly RuleFinding[];

/** One rule in the book. */
export interface Rule {
  /** Upper-case code, unique within a registry. */
  readonly code: RuleCode;
  /** Vietnamese name, lower case, sentence style. */
  readonly name: string;
  readonly group: RuleGroup;
  readonly severity: RuleSeverity;
  readonly scope: RuleScope;
  /**
   * Entity kinds this rule reads.
   *
   * Changing an entity of any of these kinds makes the rule's result stale, so
   * this list is what drives incremental re-running. Under-declaring it leaves
   * stale violations on screen; over-declaring it only costs time.
   */
  readonly dependsOn: readonly RuleSubject[];
  readonly check: RuleCheck;
}

/* -------------------------------------------------------------------------- */
/* Reading the model from inside a rule.                                       */
/* -------------------------------------------------------------------------- */

/**
 * The entities of one kind a rule is allowed to see.
 *
 * For a `level` rule that is the entities on its level; for a `building` rule,
 * all of them. The array is freshly built each call, so a rule may sort or
 * splice it without the graph noticing.
 */
export function entitiesInScope<K extends RuleSubject>(
  context: RuleContext,
  kind: K,
): EntityByKind[K][] {
  const ids =
    context.levelId === null ? context.graph.byKind[kind] : idsOnLevel(context.graph, context.levelId);
  const entities: EntityByKind[K][] = [];

  for (const id of ids) {
    const entity = context.graph.byId[id];

    if (entity !== undefined && isEntityOfKind(kind, entity)) {
      entities.push(entity);
    }
  }

  return entities;
}

/**
 * One entity by code, narrowed to the kind asked for.
 *
 * `null` covers both "no such code" and "that code is not a wall". Rules treat
 * a dangling reference as somebody else's problem — `checkIntegrity` already
 * reports it — and simply skip, rather than reporting the same broken link
 * twice in two vocabularies.
 */
export function findEntity<K extends RuleSubject>(
  context: RuleContext,
  kind: K,
  id: string,
): EntityByKind[K] | null {
  const entity = context.graph.byId[id];

  return entity !== undefined && isEntityOfKind(kind, entity) ? entity : null;
}

/** Stamp a finding with the rule and level that produced it. */
export function toViolation(rule: Rule, levelId: LevelId | null, finding: RuleFinding): Violation {
  return {
    ruleCode: rule.code,
    severity: rule.severity,
    levelId,
    entityId: finding.entityId,
    message: finding.message,
    suggestion: finding.suggestion,
  };
}

/* -------------------------------------------------------------------------- */
/* The registry.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The rule book.
 *
 * Rules keep the order they were registered in, which is the order violations
 * come back in, so the list on screen does not reshuffle itself between runs.
 */
export interface RuleRegistry {
  /** Adds a rule. Throws when its code is already taken. */
  register: (rule: Rule) => void;
  /** Adds several rules, in order. */
  registerAll: (rules: readonly Rule[]) => void;
  /** Every rule, enabled or not, in registration order. */
  list: () => readonly Rule[];
  /** Only the rules currently switched on, in registration order. */
  listEnabled: () => readonly Rule[];
  /** One rule by code; `null` when unknown. */
  get: (code: RuleCode) => Rule | null;
  /** Switches one rule on or off. Throws on an unknown code. */
  setEnabled: (code: RuleCode, enabled: boolean) => void;
  /** Is this rule switched on? Unknown codes are not. */
  isEnabled: (code: RuleCode) => boolean;
  /**
   * The enabled rules that read any of these entity kinds.
   *
   * This is the dependency map the incremental runner asks: change a wall, get
   * back every rule a wall can break.
   */
  rulesFor: (subjects: Iterable<RuleSubject>) => readonly Rule[];
}

/**
 * A fresh rule book.
 *
 * Registries are instances rather than one global, so a test can build the
 * exact book it wants and switching a rule off in one screen cannot leak into
 * another. The application shares one through `defaultRuleRegistry` in
 * `./defaults`, which is where the eight below are put in a book with the
 * seventeen from `geometry/`, `function/` and `fitout/`.
 */
export function createRuleRegistry(rules: readonly Rule[] = []): RuleRegistry {
  const ordered: Rule[] = [];
  const byCode = new Map<RuleCode, Rule>();
  const disabled = new Set<RuleCode>();

  // Inverted `dependsOn`, rebuilt on registration rather than on every query:
  // the runner asks this on every keystroke, the book changes once at start-up.
  let bySubject: Map<RuleSubject, Rule[]> | null = null;

  const buildSubjectIndex = (): Map<RuleSubject, Rule[]> => {
    const index = new Map<RuleSubject, Rule[]>();

    for (const rule of ordered) {
      for (const subject of rule.dependsOn) {
        const bucket = index.get(subject);

        if (bucket === undefined) {
          index.set(subject, [rule]);
        } else {
          bucket.push(rule);
        }
      }
    }

    return index;
  };

  const register = (rule: Rule): void => {
    if (byCode.has(rule.code)) {
      throw new Error(`registry: mã luật ${rule.code} đã được đăng ký.`);
    }

    byCode.set(rule.code, rule);
    ordered.push(rule);
    bySubject = null;
  };

  const requireRule = (code: RuleCode): Rule => {
    const rule = byCode.get(code);

    if (rule === undefined) {
      throw new Error(`registry: không có luật nào mang mã ${code}.`);
    }

    return rule;
  };

  const registry: RuleRegistry = {
    register,
    registerAll: (added) => {
      for (const rule of added) {
        register(rule);
      }
    },
    list: () => ordered,
    listEnabled: () => ordered.filter((rule) => !disabled.has(rule.code)),
    get: (code) => byCode.get(code) ?? null,
    setEnabled: (code, enabled) => {
      const rule = requireRule(code);

      if (enabled) {
        disabled.delete(rule.code);
      } else {
        disabled.add(rule.code);
      }
    },
    isEnabled: (code) => byCode.has(code) && !disabled.has(code),
    rulesFor: (subjects) => {
      if (bySubject === null) {
        bySubject = buildSubjectIndex();
      }

      // A rule that reads both walls and openings must come back once, and in
      // registration order however the subjects were listed.
      const wanted = new Set<Rule>();

      for (const subject of subjects) {
        for (const rule of bySubject.get(subject) ?? []) {
          wanted.add(rule);
        }
      }

      return ordered.filter((rule) => wanted.has(rule) && !disabled.has(rule.code));
    },
  };

  registry.registerAll(rules);

  return registry;
}

/* -------------------------------------------------------------------------- */
/* Thresholds the built-in rules measure against.                              */
/* -------------------------------------------------------------------------- */

/** Thinnest wall that can be built and still called a wall. */
export const MIN_WALL_THICKNESS_MM = 60;

/** Thickest wall before the line is more likely two walls traced as one. */
export const MAX_WALL_THICKNESS_MM = 400;

/** Shortest wall run worth keeping; below this it is a tracing artefact. */
export const MIN_WALL_LENGTH_MM = 100;

/** Narrowest door a person and a stretcher get through. */
export const MIN_DOOR_WIDTH_MM = 700;

/**
 * Smallest usable floor area per use, in square metres.
 *
 * A zero means the use has no sensible minimum — a corridor is as wide as the
 * plan makes it — and those rooms are skipped rather than measured against 0.
 */
export const MIN_ROOM_AREA_M2: Readonly<Record<RoomUsage, number>> = {
  livingRoom: 12,
  bedroom: 9,
  kitchen: 5,
  bathroom: 2.5,
  corridor: 0,
  stairwell: 0,
  utility: 0,
  other: 0,
};

/** What the interface calls each room use. */
export const ROOM_USAGE_LABELS: Readonly<Record<RoomUsage, string>> = {
  livingRoom: 'phòng khách',
  bedroom: 'phòng ngủ',
  kitchen: 'bếp',
  bathroom: 'phòng tắm',
  corridor: 'hành lang',
  stairwell: 'buồng thang',
  utility: 'phòng kỹ thuật',
  other: 'phòng khác',
};

/* -------------------------------------------------------------------------- */
/* The built-in rules.                                                         */
/* -------------------------------------------------------------------------- */

/** Elevations read in metres, three decimals, as the drawing shows them. */
function metreText(valueMm: number): string {
  return `${formatNumber(valueMm / MILLIMETRES_PER_METRE, { fractionDigits: 3 })} m`;
}

function segmentLengthMm(start: { x: number; y: number }, end: { x: number; y: number }): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

const wallThicknessRule: Rule = {
  code: 'WALL-THICKNESS',
  name: 'bề dày tường nằm trong khoảng dựng được',
  group: 'geometry',
  severity: 'warning',
  scope: 'level',
  dependsOn: ['wall'],
  check: (context) =>
    entitiesInScope(context, 'wall').flatMap((wall) => {
      const tooThin = wall.thicknessMm < MIN_WALL_THICKNESS_MM;
      const tooThick = wall.thicknessMm > MAX_WALL_THICKNESS_MM;

      if (!tooThin && !tooThick) {
        return [];
      }

      return [
        {
          entityId: wall.id,
          message:
            `Tường ${wall.id} dày ${formatLength(wall.thicknessMm, { unit: 'mm' })}, ngoài khoảng ` +
            `${formatLength(MIN_WALL_THICKNESS_MM, { unit: 'mm' })} đến ${formatLength(MAX_WALL_THICKNESS_MM, { unit: 'mm' })}.`,
          suggestion: tooThin
            ? `Tăng bề dày lên tối thiểu ${formatLength(MIN_WALL_THICKNESS_MM, { unit: 'mm' })}, hoặc xoá nếu đây là nét thừa.`
            : `Giảm bề dày xuống tối đa ${formatLength(MAX_WALL_THICKNESS_MM, { unit: 'mm' })}, hoặc tách thành hai tường.`,
        },
      ];
    }),
};

const wallLengthRule: Rule = {
  code: 'WALL-LENGTH',
  name: 'tường đủ dài để dựng',
  group: 'geometry',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['wall'],
  check: (context) =>
    entitiesInScope(context, 'wall').flatMap((wall) => {
      const lengthMm = segmentLengthMm(wall.centreline.start, wall.centreline.end);

      if (lengthMm >= MIN_WALL_LENGTH_MM) {
        return [];
      }

      return [
        {
          entityId: wall.id,
          message:
            `Tường ${wall.id} chỉ dài ${formatLength(lengthMm, { unit: 'mm' })}, ngắn hơn mức dựng được ` +
            `${formatLength(MIN_WALL_LENGTH_MM, { unit: 'mm' })}.`,
          suggestion: 'Kéo dài tường tới nút giao gần nhất, hoặc xoá đoạn thừa này.',
        },
      ];
    }),
};

const openingInWallRule: Rule = {
  code: 'OPENING-IN-WALL',
  name: 'lỗ mở nằm trọn trong tường chứa nó',
  group: 'geometry',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['opening', 'wall'],
  check: (context) =>
    entitiesInScope(context, 'opening').flatMap((opening) => {
      const wall = findEntity(context, 'wall', opening.wallId);

      if (wall === null) {
        return [];
      }

      const wallLengthMm = segmentLengthMm(wall.centreline.start, wall.centreline.end);
      const endMm = opening.offsetMm + opening.widthMm;

      if (opening.offsetMm >= 0 && endMm <= wallLengthMm) {
        return [];
      }

      const roomToMoveMm = Math.max(0, wallLengthMm - opening.widthMm);

      return [
        {
          entityId: opening.id,
          message:
            `Lỗ mở ${opening.id} trải từ ${formatLength(opening.offsetMm, { unit: 'mm' })} đến ${formatLength(endMm, { unit: 'mm' })} ` +
            `trên tường ${wall.id} chỉ dài ${formatLength(wallLengthMm, { unit: 'mm' })}.`,
          suggestion:
            roomToMoveMm > 0
              ? `Dời lỗ mở về khoảng 0 đến ${formatLength(roomToMoveMm, { unit: 'mm' })}, hoặc thu hẹp bề rộng.`
              : `Thu hẹp lỗ mở xuống tối đa ${formatLength(wallLengthMm, { unit: 'mm' })}, hoặc chuyển sang tường dài hơn.`,
        },
      ];
    }),
};

const doorWidthRule: Rule = {
  code: 'DOOR-WIDTH',
  name: 'cửa đi đủ rộng để lọt người',
  group: 'circulation',
  severity: 'warning',
  scope: 'level',
  dependsOn: ['opening'],
  check: (context) =>
    entitiesInScope(context, 'opening').flatMap((opening) => {
      if (opening.kind !== 'door' || opening.widthMm >= MIN_DOOR_WIDTH_MM) {
        return [];
      }

      return [
        {
          entityId: opening.id,
          message:
            `Cửa đi ${opening.id} rộng ${formatLength(opening.widthMm, { unit: 'mm' })}, hẹp hơn mức lọt người ` +
            `${formatLength(MIN_DOOR_WIDTH_MM, { unit: 'mm' })}.`,
          suggestion: `Mở rộng cửa lên tối thiểu ${formatLength(MIN_DOOR_WIDTH_MM, { unit: 'mm' })}.`,
        },
      ];
    }),
};

const roomMinAreaRule: Rule = {
  code: 'ROOM-MIN-AREA',
  name: 'phòng đủ diện tích cho công năng của nó',
  group: 'area',
  severity: 'warning',
  scope: 'level',
  dependsOn: ['room'],
  check: (context) =>
    entitiesInScope(context, 'room').flatMap((room) => {
      const minimumM2 = MIN_ROOM_AREA_M2[room.usage];

      if (minimumM2 <= 0 || room.areaM2 >= minimumM2) {
        return [];
      }

      return [
        {
          entityId: room.id,
          message:
            `Phòng ${room.id} rộng ${formatArea(room.areaM2)}, dưới mức tối thiểu ` +
            `${formatArea(minimumM2)} của ${ROOM_USAGE_LABELS[room.usage]}.`,
          suggestion: `Mở rộng phòng lên ${formatArea(minimumM2)}, hoặc đổi công năng cho phù hợp.`,
        },
      ];
    }),
};

const roomHasDoorRule: Rule = {
  code: 'ROOM-HAS-DOOR',
  name: 'phòng có lối vào',
  group: 'circulation',
  severity: 'warning',
  scope: 'level',
  dependsOn: ['room', 'wall', 'opening'],
  check: (context) =>
    entitiesInScope(context, 'room').flatMap((room) => {
      const hasDoor = room.wallIds.some((wallId) => {
        const wall = findEntity(context, 'wall', wallId);

        if (wall === null) {
          return false;
        }

        return wall.openingIds.some((openingId) => {
          const opening = findEntity(context, 'opening', openingId);

          return opening !== null && opening.kind === 'door';
        });
      });

      if (hasDoor) {
        return [];
      }

      return [
        {
          entityId: room.id,
          message:
            `Phòng ${room.id} không có cửa đi nào trên ${formatNumber(room.wallIds.length, { fractionDigits: 0 })} ` +
            'tường bao của nó.',
          suggestion: 'Thêm một cửa đi vào một tường bao, hoặc gộp phòng này với phòng bên cạnh.',
        },
      ];
    }),
};

const roomNamedRule: Rule = {
  code: 'ROOM-UNNAMED',
  name: 'phòng đã được đặt tên',
  group: 'annotation',
  severity: 'suggestion',
  scope: 'level',
  dependsOn: ['room'],
  check: (context) =>
    entitiesInScope(context, 'room').flatMap((room) => {
      if (room.name.trim() !== '') {
        return [];
      }

      return [
        {
          entityId: room.id,
          message: `Phòng ${room.id} chưa được đặt tên.`,
          suggestion: 'Đặt tên phòng theo công năng để bảng thống kê đọc được.',
        },
      ];
    }),
};

const levelElevationRule: Rule = {
  code: 'LEVEL-ELEVATION',
  name: 'cao độ các tầng tăng dần từ dưới lên',
  group: 'levels',
  severity: 'critical',
  scope: 'building',
  dependsOn: ['level'],
  check: (context) => {
    const stacked = entitiesInScope(context, 'level').sort((first, second) => first.order - second.order);
    const findings: RuleFinding[] = [];

    for (let index = 1; index < stacked.length; index += 1) {
      const lower = stacked[index - 1];
      const upper = stacked[index];

      if (lower === undefined || upper === undefined || upper.elevationMm > lower.elevationMm) {
        continue;
      }

      findings.push({
        entityId: upper.id,
        message:
          `Tầng ${upper.id} ở cao độ ${metreText(upper.elevationMm)}, không cao hơn tầng ` +
          `${lower.id} ở ${metreText(lower.elevationMm)}.`,
        suggestion: `Nâng cao độ tầng ${upper.id} lên trên ${metreText(lower.elevationMm)}, hoặc đổi thứ tự tầng.`,
      });
    }

    return findings;
  },
};

/**
 * The rules that ship with the application.
 *
 * The order here is the order violations are listed in, so it reads top down:
 * the geometry that stops the model being buildable, then how people move
 * through it, then what it measures, then what it is called, then the stack.
 */
export const BUILT_IN_RULES: readonly Rule[] = [
  wallThicknessRule,
  wallLengthRule,
  openingInWallRule,
  doorWidthRule,
  roomMinAreaRule,
  roomHasDoorRule,
  roomNamedRule,
  levelElevationRule,
];
