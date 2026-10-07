import type { AnyNode, AnyNodeId } from '@pascal-app/core';
import type { FloorplanSchedule } from './floorplan-extension';
export type ScheduleUnit = 'metric' | 'imperial';
export type OpeningScheduleRow = {
    id: string;
    mark: string;
    type: string;
    /** Metres. */
    width: number;
    /** Metres. */
    height: number;
    widthText: string;
    heightText: string;
    sizeText: string;
    /** Rough opening as "W x H", or `null` when it was never entered. */
    roughOpening: string | null;
    /** Frame material / thickness-depth where the model knows it. */
    material: string | null;
    frame: string | null;
    hardware: string | null;
    /** How many identical openings this row stands for (grouped rows only). */
    count: number;
    remarks: string;
};
export type RoomScheduleRow = {
    id: string;
    number: string;
    name: string;
    /** Square metres. */
    area: number;
    areaText: string;
    floorFinish: string | null;
    ceilingHeight: number;
    remarks: string;
};
export type ScheduleResult<TRow> = {
    rows: TRow[];
    issues: string[];
};
export type ScheduleSceneInput = {
    nodes: Readonly<Record<string, AnyNode>>;
} | Readonly<Record<string, AnyNode>>;
export type ScheduleOptions = {
    unit?: ScheduleUnit;
    /** Collapse identical openings into one row carrying `count`. Default false. */
    group?: boolean;
};
export declare function doorSchedule(scene: ScheduleSceneInput, levelId?: AnyNodeId, options?: ScheduleOptions): ScheduleResult<OpeningScheduleRow>;
export declare function windowSchedule(scene: ScheduleSceneInput, levelId?: AnyNodeId, options?: ScheduleOptions): ScheduleResult<OpeningScheduleRow>;
export declare function roomSchedule(scene: ScheduleSceneInput, levelId?: AnyNodeId, options?: ScheduleOptions): ScheduleResult<RoomScheduleRow>;
/**
 * The registry-driven schedules the PDF export renders. Kept as the single
 * source for the PDF so extending this module never forks that output.
 */
export declare function floorplanSchedules(nodes: Record<string, AnyNode>, levelId: AnyNodeId, unit: ScheduleUnit): FloorplanSchedule[];
export declare function formatScheduleLength(metres: number, unit: ScheduleUnit): string;
//# sourceMappingURL=schedules.d.ts.map