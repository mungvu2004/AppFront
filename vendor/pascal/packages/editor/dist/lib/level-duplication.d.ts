import { type AnyNode, type AnyNodeId, type LevelNode } from '@pascal-app/core/schema';
export type LevelDuplicatePreset = 'everything' | 'structure' | 'structure-materials' | 'structure-furniture';
export declare function buildLevelDuplicateCreateOps({ nodes, level, levels, preset, }: {
    nodes: Record<AnyNodeId, AnyNode>;
    level: LevelNode;
    levels: LevelNode[];
    preset: LevelDuplicatePreset;
}): {
    createOps: {
        node: {
            object: "node";
            metadata: Record<string, unknown>;
            polygon: {
                type: "polygon";
                points: [number, number][];
            };
            id: `site_${string}`;
            parentId: string | null;
            visible: boolean;
            children: string[];
            type: "site";
            address?: {
                street?: string | undefined;
                city?: string | undefined;
                state?: string | undefined;
                zip?: string | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            terrain?: {
                type: "heightfield";
                origin: [number, number];
                spacing: number;
                cols: number;
                rows: number;
                step: number;
                heights: string;
            } | undefined;
            parcel?: {
                apn?: string | undefined;
                source?: string | undefined;
                county?: string | undefined;
                state?: string | undefined;
                lotAreaSqFt?: number | undefined;
                originLngLat?: [number, number] | undefined;
                resolvedAt?: string | undefined;
                layer?: string | undefined;
                notes?: string[] | undefined;
            } | undefined;
            setbacks?: {
                front: number;
                side: number;
                rear: number;
                left?: number | undefined;
                right?: number | undefined;
                streetSide?: number | undefined;
            } | undefined;
            setbacksSource?: string | undefined;
            zone?: string | undefined;
            frontEdge?: number | undefined;
            streetEdges?: number[] | undefined;
            sightTriangleFt?: number | undefined;
            northRotation?: number | undefined;
            dossier?: {
                [x: string]: unknown;
                provider: string;
                asOf: string;
                sections: Record<string, {
                    [x: string]: unknown;
                    status: string;
                    summary?: string | undefined;
                    reason?: string | undefined;
                    source?: {
                        name?: string | undefined;
                        kind?: string | undefined;
                        vintage?: string | undefined;
                        attribution?: string | undefined;
                    } | undefined;
                }>;
                point?: {
                    lat?: number | undefined;
                    lng?: number | undefined;
                    source?: string | undefined;
                } | undefined;
                address?: {
                    formatted?: string | undefined;
                    precision?: string | undefined;
                } | undefined;
                parcel?: Record<string, unknown> | undefined;
                flood?: Record<string, unknown> | undefined;
                codeBasis?: Record<string, unknown> | undefined;
                zoning?: Record<string, unknown> | undefined;
                utilities?: Record<string, unknown> | undefined;
                soils?: Record<string, unknown> | undefined;
                wetlands?: Record<string, unknown> | undefined;
                structures?: Record<string, unknown> | undefined;
                elevation?: Record<string, unknown> | undefined;
                boundaries?: Record<string, unknown> | undefined;
            } | undefined;
            contourIntervalIn?: number | undefined;
            contours3d?: boolean | undefined;
            terrainContours?: {
                datum: string;
                intervalFt: number;
                lines: {
                    elevationFt: number;
                    points: [number, number][];
                }[];
                source?: string | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `building_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            children: (`level_${string}` | `elevator_${string}` | `unit_${string}`)[];
            type: "building";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `elevator_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            width: number;
            depth: number;
            shaftWallThickness: number;
            shaftStyle: "glass" | "solid";
            cabHeight: number;
            doorWidth: number;
            doorHeight: number;
            doorStyle: "center-opening" | "single-left" | "single-right";
            doorPanelStyle: "glass-frame" | "solid-panel" | "segmented-panel";
            fromLevelId: string | null;
            toLevelId: string | null;
            disabledLevelIds: string[];
            serviceOnlyLevelIds: string[];
            defaultLevelId: string | null;
            speed: number;
            doorDurationMs: number;
            dwellMs: number;
            type: "elevator";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            slots?: Record<string, string> | undefined;
            shaftWidth?: number | undefined;
            shaftDepth?: number | undefined;
            servedLevelIds?: string[] | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `unit_${string}`;
            color: string;
            name: string;
            parentId: string | null;
            visible: boolean;
            kind: "apartment" | "hotel-room" | "commercial" | "common";
            members: `zone_${string}`[];
            type: "unit";
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `level_${string}`;
            parentId: string | null;
            visible: boolean;
            children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
            level: number;
            baseElevation: number;
            type: "level";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            height?: number | undefined;
        } | {
            object: "node";
            span: number;
            metadata: Record<string, unknown>;
            id: `leanto_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            children: (`roof_${string}` | `column_${string}`)[];
            pitch: number;
            shingleThickness: number;
            canopyForm: "gable" | "mono" | "butterfly";
            hostKind: "wall" | "slab-edge" | "freestanding" | "conical-roof";
            hostHeightOffset: number;
            autoSpan: boolean;
            projection: number;
            highEdgeHeight: number;
            lowEdgeHeight: number;
            resizeLock: "preserve-high-edge" | "preserve-low-edge" | "preserve-pitch";
            leftEndCondition: "open" | "wall-abutment" | "joined";
            rightEndCondition: "open" | "wall-abutment" | "joined";
            autoMiterCorners: boolean;
            sideFlashing: boolean;
            flashingProjection: number;
            flashingHeight: number;
            highSideMode: "wall-ledger" | "independent-high-beam";
            ledgerVerticalOffset: number;
            lowBeamInset: number;
            gutterEnabled: boolean;
            gutterProfile: "box" | "k-style" | "half-round";
            gutterSize: number;
            downspoutEnabled: boolean;
            downspoutPosition: number;
            connectionMode: "auto" | "manual";
            connectionOffset: number;
            connectionInset: number;
            matchHostRoofMaterial: boolean;
            matchHostRoofStructure: boolean;
            roofThickness: number;
            highOverhang: number;
            lowOverhang: number;
            leftOverhang: number;
            rightOverhang: number;
            coveringType: "generic" | "shingle" | "metal-panel";
            beamWidth: number;
            beamHeight: number;
            ledgerDepth: number;
            ledgerHeight: number;
            rafterWidth: number;
            rafterHeight: number;
            rafterSpacing: number;
            rafterEndInset: number;
            framingStrategy: "hidden" | "rafters" | "purlins" | "covering-specific";
            purlinWidth: number;
            purlinHeight: number;
            purlinSpacing: number;
            postWidth: number;
            postDepth: number;
            postCount: number;
            postLayoutMode: "count" | "target-spacing";
            postSpacing: number;
            postInset: number;
            omittedPostSlots: {
                side: "low" | "high";
                index: number;
                layoutCount: number;
            }[];
            postBracing: "none" | "knee";
            footingStyle: "none" | "base-plate" | "concrete-pad";
            type: "lean-to-extension";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            hostSlabId?: `slab_${string}` | undefined;
            hostSlabEdgeIndex?: number | undefined;
            hostSlabEdgeT?: number | undefined;
            spanArcCenterZ?: number | undefined;
            spanArcRadius?: number | undefined;
            hostRoofId?: `roof_${string}` | undefined;
            hostRoofSegmentId?: string | undefined;
            hostRoofEdge?: "+X" | "-X" | "+Z" | "-Z" | undefined;
            hostRoofEdgeRange?: [number, number] | undefined;
        } | {
            object: "node";
            style: "plain" | "faceted" | "fluted" | "lathe-turned" | "dravidian-carved" | "cluster";
            metadata: Record<string, unknown>;
            id: `column_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            children: string[];
            width: number;
            depth: number;
            radius: number;
            height: number;
            crossSection: "round" | "square" | "rectangular" | "octagonal" | "sixteen-sided";
            edgeSoftness: number;
            baseHeight: number;
            capitalHeight: number;
            shaftProfile: "straight" | "tapered" | "bulged" | "baluster" | "hourglass";
            shaftTaper: number;
            shaftBulge: number;
            shaftStartScale: number;
            shaftEndScale: number;
            shaftSegmentCount: number;
            shaftTwistStep: number;
            shaftCornerRadius: number;
            shaftDetail: "none" | "fluted" | "lathe-turned" | "spiral" | "panelled";
            baseStyle: "none" | "simple-square" | "round-rings" | "square-plinth" | "stepped-square" | "lotus" | "ribbed-lotus" | "panelled-pedestal";
            baseWidthScale: number;
            baseDepthScale: number;
            baseTierCount: number;
            baseStepSpread: number;
            basePlinthHeightRatio: number;
            baseRoundBandScale: number;
            baseNeckScale: number;
            baseRoundBandCount: number;
            baseRibCount: number;
            baseCarvingLevel: number;
            basePanelInset: number;
            capitalStyle: "none" | "simple" | "simple-slab" | "rounded" | "stepped" | "doric" | "volute" | "ionic-volute" | "leaf-carved" | "corinthian-leaf" | "south-indian-bracket" | "wood-bracket";
            capitalWidthScale: number;
            capitalDepthScale: number;
            capitalTierCount: number;
            capitalStepSpread: number;
            capitalBandCount: number;
            voluteSize: number;
            voluteCount: number;
            leafCount: number;
            leafRows: number;
            bracketDepth: number;
            bracketTierCount: number;
            pendantCount: number;
            capitalCarvingLevel: number;
            ringCount: number;
            ringPlacement: "bottom" | "top" | "ends" | "even";
            ringThickness: number;
            ringSpread: number;
            fluteCount: number;
            fluteDepth: number;
            fluteWidth: number;
            spiralTwist: number;
            spiralRibCount: number;
            panelCount: number;
            panelInsetDepth: number;
            panelShape: "rectangle" | "arched" | "diamond";
            latheRingCount: number;
            latheRingSpacing: "bottom" | "top" | "ends" | "even";
            carvingLevel: number;
            carvingPlacement: "base" | "shaft" | "capital" | "all";
            lowerBandEnabled: boolean;
            lowerBandHeight: number;
            lowerBandCarvingLevel: number;
            dentilCount: number;
            beadCount: number;
            supportStyle: "vertical" | "a-frame" | "y-frame" | "v-frame" | "x-brace" | "k-brace" | "single-strut" | "tripod" | "trestle" | "portal-frame" | "box-frame";
            braceWidth: number;
            braceDepth: number;
            braceBottomSpread: number;
            braceTopSpread: number;
            bracePlateEnabled: boolean;
            type: "column";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            slots?: Record<string, string> | undefined;
            supportSlabId?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `construction-dimension_${string}`;
            parentId: string | null;
            visible: boolean;
            mode: "radius" | "linear" | "diameter" | "center-mark" | "chord" | "arc-length" | "angular" | "coordinate";
            anchors: ([number, number, number] | {
                kind: "feature";
                reference: {
                    nodeId: string;
                    featureId: string;
                    parameters?: Record<string, string | number | boolean> | undefined;
                };
                fallback: [number, number, number];
            })[];
            baseline: {
                origin: [number, number];
                direction: [number, number];
            };
            chainMode: "continuous" | "point-to-point";
            featureCount: number;
            showCenterMark: boolean;
            prefix: string;
            suffix: string;
            textOverride: string | null;
            datumPolicy: "centerline" | "wall-face" | "structural-face" | "finish-face";
            terminator: "architectural-tick" | "filled-arrow" | "open-arrow" | "dot";
            textPosition: "above" | "centered";
            imperialPrecision: "1" | "1/2" | "1/4" | "1/8" | "1/16";
            metricNotation: "meters" | "millimeters";
            extensionStartGap: number;
            extensionOvershoot: number;
            drawingType: "floor-plan" | "foundation-plan" | "reflected-ceiling-plan" | "roof-plan" | "site-plan";
            drawingOverrides: {
                drawingType: "floor-plan" | "foundation-plan" | "reflected-ceiling-plan" | "roof-plan" | "site-plan";
                presentation: "omit" | "shown" | "controlled";
                suppressedSegmentIndexes: number[];
            }[];
            controllingDimensionId: `construction-dimension_${string}` | null;
            type: "construction-dimension";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `block_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            slots: Record<string, string>;
            children: string[];
            topology: {
                vertices: {
                    id: string;
                    position: [number, number, number];
                }[];
                edges: {
                    id: string;
                    vertexIds: [string, string];
                }[];
                faces: {
                    id: string;
                    vertexIds: string[];
                    materialSlot: string;
                }[];
            };
            slotNames: Record<string, string>;
            type: "block";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            supportSlabId?: string | undefined;
        } | {
            object: "node";
            label: string;
            metadata: Record<string, unknown>;
            id: `structural-grid_${string}`;
            parentId: string | null;
            visible: boolean;
            start: [number, number];
            end: [number, number];
            showStartBubble: boolean;
            showEndBubble: boolean;
            type: "structural-grid";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `wall_${string}`;
            parentId: string | null;
            visible: boolean;
            children: (`item_${string}` | `procedural-item_${string}` | `leanto_${string}` | `door_${string}` | `window_${string}`)[];
            start: [number, number];
            end: [number, number];
            frontSide: "unknown" | "exterior" | "interior";
            backSide: "unknown" | "exterior" | "interior";
            type: "wall";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            assembly?: {
                framing: {
                    kind: "wood" | "lgs" | "cmu" | "icf";
                    depth: number;
                };
                preset?: string | undefined;
                exterior?: {
                    finish: "brick" | "none" | "siding" | "stucco" | "stone" | "fiber-cement";
                    thickness: number;
                } | undefined;
                sheathing?: {
                    material: "none" | "osb" | "plywood" | "gypsum";
                    thickness: number;
                } | undefined;
                interior?: {
                    finish: "plaster" | "none" | "drywall";
                    thickness: number;
                } | undefined;
                cavityInsulation?: string | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            thickness?: number | undefined;
            height?: number | undefined;
            supportSlabId?: string | undefined;
            wallType?: "standard" | "curtain" | undefined;
            curtainWall?: {
                construction: "stick" | "unitized";
                framing: "capped" | "vertical-caps" | "horizontal-caps" | "structural-glazing";
                columns: {
                    layout: "count" | "maximum-spacing" | "fixed-spacing";
                    count: number;
                    spacing: number;
                    alignment: "center" | "start" | "end";
                };
                rows: {
                    layout: "count" | "maximum-spacing" | "fixed-spacing";
                    count: number;
                    spacing: number;
                    alignment: "center" | "start" | "end";
                };
                mullionWidth: number;
                transomWidth: number;
                perimeterWidth: number;
                jointWidth: number;
                glassThickness: number;
                panelType: "glass" | "solid" | "empty";
                spandrel: "bottom" | "top" | "none";
                frameColor: string;
                glassColor: string;
                solidColor: string;
                glassOpacity: number;
                glassRoughness: number;
                panels: {
                    column: number;
                    row: number;
                    type: "glass" | "solid" | "empty";
                }[];
            } | undefined;
            interiorMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            interiorMaterialPreset?: string | undefined;
            exteriorMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            exteriorMaterialPreset?: string | undefined;
            curveOffset?: number | undefined;
            supportOffset?: number | undefined;
            fillToTerrain?: boolean | undefined;
            underpinning?: {
                rim: number;
                stem: number;
                openings?: {
                    u: number;
                    width: number;
                    top: number;
                    bottom: number;
                }[] | undefined;
            } | undefined;
            faceBands?: {
                enabled: boolean;
                count: number;
                lowerHeight: number;
                middleHeight: number;
                upperHeight: number;
            } | undefined;
            skirting?: {
                enabled: boolean;
                sides: "exterior" | "interior" | "both";
                height: number;
                proud: number;
                profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
                offsetY?: number | undefined;
            } | undefined;
            crown?: {
                enabled: boolean;
                sides: "exterior" | "interior" | "both";
                height: number;
                proud: number;
                profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
                offsetY?: number | undefined;
            } | undefined;
            chairRail?: {
                enabled: boolean;
                sides: "exterior" | "interior" | "both";
                height: number;
                proud: number;
                profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
                offsetY?: number | undefined;
            } | undefined;
        } | {
            object: "node";
            style: "slat" | "rail" | "privacy" | "horizontal" | "guard";
            metadata: Record<string, unknown>;
            id: `fence_${string}`;
            color: string;
            parentId: string | null;
            visible: boolean;
            thickness: number;
            height: number;
            postSpacing: number;
            baseHeight: number;
            baseStyle: "floating" | "grounded" | "raised";
            start: [number, number];
            end: [number, number];
            postSize: number;
            topRailHeight: number;
            groundClearance: number;
            edgeInset: number;
            slatGap: number;
            postCap: "flat" | "none" | "pyramid";
            showInfill: boolean;
            type: "fence";
            path?: [number, number][] | undefined;
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            slots?: Record<string, string> | undefined;
            supportSlabId?: string | undefined;
            curveOffset?: number | undefined;
            supportOffset?: number | undefined;
            tangents?: ([number, number] | null)[] | undefined;
            guardInfill?: "balusters" | "cable" | "boards" | undefined;
            startPost?: boolean | undefined;
            endPost?: boolean | undefined;
            postThrough?: boolean | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `cabinet_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            children: string[];
            width: number;
            depth: number;
            carcassHeight: number;
            operationState: number;
            plinthHeight: number;
            toeKickDepth: number;
            boardThickness: number;
            countertopThickness: number;
            countertopOverhang: number;
            countertopBackOverhang: number;
            withFinishedBack: boolean;
            frontThickness: number;
            frontGap: number;
            frontStyle: "slab" | "shaker" | "raised-arch";
            panelReady: boolean;
            handleStyle: "none" | "bar" | "cutout" | "hole" | "knob";
            handlePosition: "center" | "top" | "auto";
            frontOverlay: "inset" | "full";
            withBottomPanel: boolean;
            showPlinth: boolean;
            withCountertop: boolean;
            runTier: "base" | "wall" | "tall";
            withWaterfall: boolean;
            withFinishedEnds: boolean;
            type: "cabinet";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            slots?: Record<string, string> | undefined;
            supportSlabId?: string | undefined;
            stack?: ({
                type: "shelf";
                id: string;
                shelfCount?: number | undefined;
                height?: number | undefined;
            } | {
                type: "drawer";
                id: string;
                drawerCount?: number | undefined;
                height?: number | undefined;
            } | {
                type: "door";
                id: string;
                doorType?: "glass" | "double" | "single-left" | "single-right" | undefined;
                shelfCount?: number | undefined;
                height?: number | undefined;
            } | {
                type: "sink";
                id: string;
                sinkLayout?: "single" | "double" | "double-offset" | undefined;
                height?: number | undefined;
            } | {
                type: "oven";
                id: string;
                height?: number | undefined;
            } | {
                type: "microwave";
                id: string;
                height?: number | undefined;
            } | {
                type: "dishwasher";
                id: string;
                height?: number | undefined;
            } | {
                type: "cooktop-gas";
                id: string;
                cooktopLayout?: "gas-2burner" | "gas-4burner" | "gas-5burner-wok" | "gas-6burner" | undefined;
                cooktopBurnersOn?: boolean | undefined;
                cooktopActiveBurners?: number[] | undefined;
                cooktopKnobProgress?: number[] | undefined;
                cooktopShowGrate?: boolean | undefined;
                height?: number | undefined;
            } | {
                type: "cooktop-induction";
                id: string;
                cooktopLayout?: "induction-2zone" | "induction-4zone" | undefined;
                cooktopBurnersOn?: boolean | undefined;
                cooktopActiveBurners?: number[] | undefined;
                cooktopKnobProgress?: number[] | undefined;
                cooktopShowGrate?: boolean | undefined;
                height?: number | undefined;
            } | {
                type: "pull-out-pantry";
                id: string;
                shelfCount?: number | undefined;
                pantryRackStyle?: "glass" | "wire" | "tray" | undefined;
                height?: number | undefined;
            } | {
                type: "fridge-single";
                id: string;
                height?: number | undefined;
            } | {
                type: "fridge-double";
                id: string;
                height?: number | undefined;
            } | {
                type: "fridge-top-freezer";
                id: string;
                height?: number | undefined;
            } | {
                type: "fridge-bottom-freezer";
                id: string;
                height?: number | undefined;
            } | {
                type: "hood-pyramid";
                id: string;
                height?: number | undefined;
            } | {
                type: "hood-curved-glass";
                id: string;
                height?: number | undefined;
            })[] | undefined;
            barLedge?: {
                edge: "back" | "left" | "right";
                height: number;
                depth: number;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `cabinet-module_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            children: string[];
            width: number;
            depth: number;
            carcassHeight: number;
            operationState: number;
            plinthHeight: number;
            toeKickDepth: number;
            boardThickness: number;
            countertopThickness: number;
            countertopOverhang: number;
            countertopBackOverhang: number;
            withFinishedBack: boolean;
            frontThickness: number;
            frontGap: number;
            frontStyle: "slab" | "shaker" | "raised-arch";
            panelReady: boolean;
            handleStyle: "none" | "bar" | "cutout" | "hole" | "knob";
            handlePosition: "center" | "top" | "auto";
            frontOverlay: "inset" | "full";
            withBottomPanel: boolean;
            showPlinth: boolean;
            withCountertop: boolean;
            cabinetType: "base" | "tall";
            moduleKind: "standard" | "corner-filler";
            topFinish: "trim" | "none" | "top-cabinet";
            topFinishHeight: number;
            topFinishDepth: number;
            type: "cabinet-module";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            slots?: Record<string, string> | undefined;
            supportSlabId?: string | undefined;
            stack?: ({
                type: "shelf";
                id: string;
                shelfCount?: number | undefined;
                height?: number | undefined;
            } | {
                type: "drawer";
                id: string;
                drawerCount?: number | undefined;
                height?: number | undefined;
            } | {
                type: "door";
                id: string;
                doorType?: "glass" | "double" | "single-left" | "single-right" | undefined;
                shelfCount?: number | undefined;
                height?: number | undefined;
            } | {
                type: "sink";
                id: string;
                sinkLayout?: "single" | "double" | "double-offset" | undefined;
                height?: number | undefined;
            } | {
                type: "oven";
                id: string;
                height?: number | undefined;
            } | {
                type: "microwave";
                id: string;
                height?: number | undefined;
            } | {
                type: "dishwasher";
                id: string;
                height?: number | undefined;
            } | {
                type: "cooktop-gas";
                id: string;
                cooktopLayout?: "gas-2burner" | "gas-4burner" | "gas-5burner-wok" | "gas-6burner" | undefined;
                cooktopBurnersOn?: boolean | undefined;
                cooktopActiveBurners?: number[] | undefined;
                cooktopKnobProgress?: number[] | undefined;
                cooktopShowGrate?: boolean | undefined;
                height?: number | undefined;
            } | {
                type: "cooktop-induction";
                id: string;
                cooktopLayout?: "induction-2zone" | "induction-4zone" | undefined;
                cooktopBurnersOn?: boolean | undefined;
                cooktopActiveBurners?: number[] | undefined;
                cooktopKnobProgress?: number[] | undefined;
                cooktopShowGrate?: boolean | undefined;
                height?: number | undefined;
            } | {
                type: "pull-out-pantry";
                id: string;
                shelfCount?: number | undefined;
                pantryRackStyle?: "glass" | "wire" | "tray" | undefined;
                height?: number | undefined;
            } | {
                type: "fridge-single";
                id: string;
                height?: number | undefined;
            } | {
                type: "fridge-double";
                id: string;
                height?: number | undefined;
            } | {
                type: "fridge-top-freezer";
                id: string;
                height?: number | undefined;
            } | {
                type: "fridge-bottom-freezer";
                id: string;
                height?: number | undefined;
            } | {
                type: "hood-pyramid";
                id: string;
                height?: number | undefined;
            } | {
                type: "hood-curved-glass";
                id: string;
                height?: number | undefined;
            })[] | undefined;
            openSide?: "left" | "right" | undefined;
            cornerShelf?: boolean | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `item_${string}`;
            scale: [number, number, number];
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            children: string[];
            asset: {
                id: string;
                category: string;
                name: string;
                thumbnail: string;
                source: "library" | "community" | "mine";
                src: string;
                dimensions: [number, number, number];
                offset: [number, number, number];
                rotation: [number, number, number];
                scale: [number, number, number];
                floorPlanUrl?: string | undefined;
                isDraft?: boolean | undefined;
                attachTo?: "wall" | "ceiling" | "wall-side" | undefined;
                recessed?: boolean | undefined;
                tags?: string[] | undefined;
                functionTags?: string[] | undefined;
                surface?: {
                    height: number;
                } | undefined;
                interactive?: {
                    controls: ({
                        kind: "toggle";
                        label?: string | undefined;
                        default?: boolean | undefined;
                    } | {
                        kind: "slider";
                        label: string;
                        min: number;
                        max: number;
                        step: number;
                        displayMode: "slider" | "stepper" | "dial";
                        unit?: string | undefined;
                        default?: number | undefined;
                    } | {
                        kind: "temperature";
                        label: string;
                        min: number;
                        max: number;
                        unit: "C" | "F";
                        default?: number | undefined;
                    })[];
                    effects: ({
                        kind: "animation";
                        clips: {
                            on?: string | undefined;
                            off?: string | undefined;
                            loop?: string | undefined;
                        };
                    } | {
                        kind: "light";
                        color: string;
                        intensityRange: [number, number];
                        offset: [number, number, number];
                        distance?: number | undefined;
                    })[];
                } | undefined;
            };
            type: "item";
            side?: "front" | "back" | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            roofSegmentId?: string | undefined;
            supportSlabId?: string | undefined;
            wallId?: string | undefined;
            wallT?: number | undefined;
            roofFace?: "front" | "back" | "left" | "right" | undefined;
            blockFaceId?: string | undefined;
            collectionIds?: `collection_${string}`[] | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `procedural-item_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            slots: Record<string, string>;
            children: string[];
            recipe: {
                version: 1;
                name: string;
                description: string;
                parameters: {
                    id: string;
                    label: string;
                    default: number;
                    min: number;
                    max: number;
                    step: number;
                    unit: "count" | "m" | "rad" | "s";
                    part?: string | undefined;
                    axis?: "x" | "y" | "z" | undefined;
                }[];
                slots: {
                    id: string;
                    label: string;
                    color: string;
                    finish?: "wood" | "glass" | "metal" | undefined;
                }[];
                parts: {
                    id: string;
                    label: string;
                    count: import("@pascal-app/core/procedural-items").Expr;
                    shapes: {
                        id: string;
                        primitive: "box" | "roundedBox" | "cylinder" | "ellipsoid";
                        slot: string;
                        size: [import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr];
                        position: [import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr];
                        rotation?: [import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr] | undefined;
                        radius?: import("@pascal-app/core/procedural-items").Expr | undefined;
                        topScale?: import("@pascal-app/core/procedural-items").Expr | undefined;
                        support?: boolean | undefined;
                    }[];
                    motion?: {
                        kind: "hinge";
                        pivot: [import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr];
                        axis: "x" | "y" | "z";
                        angle: import("@pascal-app/core/procedural-items").Expr;
                        delay?: import("@pascal-app/core/procedural-items").Expr | undefined;
                        duration?: import("@pascal-app/core/procedural-items").Expr | undefined;
                        easing?: "linear" | "smooth" | "soft" | undefined;
                    } | {
                        kind: "slide";
                        axis: "x" | "y" | "z";
                        distance: import("@pascal-app/core/procedural-items").Expr;
                        delay?: import("@pascal-app/core/procedural-items").Expr | undefined;
                        duration?: import("@pascal-app/core/procedural-items").Expr | undefined;
                        easing?: "linear" | "smooth" | "soft" | undefined;
                    } | {
                        kind: "spin";
                        pivot: [import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr];
                        axis: "x" | "y" | "z";
                        radiansPerSecond: import("@pascal-app/core/procedural-items").Expr;
                    } | undefined;
                    light?: {
                        position: [import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr];
                        color: string;
                        intensity?: number | undefined;
                        distance?: number | undefined;
                        emissiveSlot?: string | undefined;
                    } | undefined;
                }[];
                constraints: {
                    left: import("@pascal-app/core/procedural-items").Expr;
                    relation: "lte" | "gte";
                    right: import("@pascal-app/core/procedural-items").Expr;
                    message: string;
                }[];
                classification?: {
                    category: string;
                    functionTags: string[];
                    tags: string[];
                } | undefined;
                mounting?: {
                    attachTo: "ceiling" | "wall-side";
                    reference: string;
                } | undefined;
                surfaces?: {
                    id: string;
                    label: string;
                    position: [import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr];
                    size: [import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr];
                    part?: string | undefined;
                    rotation?: [import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr, import("@pascal-app/core/procedural-items").Expr] | undefined;
                }[] | undefined;
            };
            parameters: Record<string, number>;
            attachments: Record<string, string>;
            type: "procedural-item";
            side?: "front" | "back" | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            supportSlabId?: string | undefined;
            wallId?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `imesh_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            primitives: {
                positions: number[];
                indices: number[];
                color: string;
                opacity: number;
                normals?: number[] | undefined;
            }[];
            type: "imported-mesh";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            polygon: [number, number][];
            id: `zone_${string}`;
            color: string;
            name: string;
            parentId: string | null;
            visible: boolean;
            autoFromWalls: boolean;
            boundaryWallIds: `wall_${string}`[];
            spaceRole: "room" | "generic";
            roomNumber: string;
            enclosureStatus: "auto" | "open" | "enclosed";
            floorFinish: string;
            wallFinish: string;
            ceilingFinish: string;
            ceilingHeight: number;
            occupancy: string;
            clearDimensionPolicy: "none" | "inside-faces" | "finish-faces";
            type: "zone";
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            polygon: [number, number][];
            id: `slab_${string}`;
            parentId: string | null;
            visible: boolean;
            thickness: number;
            elevation: number;
            autoFromWalls: boolean;
            holes: [number, number][][];
            holeMetadata: {
                source: "stair" | "elevator" | "manual";
                stairId?: string | undefined;
                elevatorId?: string | undefined;
            }[];
            recessed: boolean;
            type: "slab";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            slots?: Record<string, string> | undefined;
            fillToTerrain?: boolean | undefined;
            recessedRimElevation?: number | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            polygon: [number, number][];
            id: `ceiling_${string}`;
            parentId: string | null;
            visible: boolean;
            children: (`item_${string}` | `procedural-item_${string}`)[];
            autoFromWalls: boolean;
            holes: [number, number][][];
            holeMetadata: {
                source: "stair" | "elevator" | "manual";
                stairId?: string | undefined;
                elevatorId?: string | undefined;
            }[];
            type: "ceiling";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            slots?: Record<string, string> | undefined;
            height?: number | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `roof_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            support: {
                kind: "level";
            } | {
                kind: "walls";
            } | {
                kind: "roof";
                roofSegmentId: `rseg_${string}`;
                localPosition: [number, number];
                curbHeight: number;
            };
            children: `rseg_${string}`[];
            type: "roof";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            topMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            topMaterialPreset?: string | undefined;
            edgeMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            edgeMaterialPreset?: string | undefined;
            wallMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            wallMaterialPreset?: string | undefined;
            assembly?: {
                layers: {
                    id: string;
                    role: "fill" | "finish" | "lining" | "substrate" | "sheathing" | "membrane" | "underlay" | "insulation" | "air" | "furring" | "structure" | "deck" | "covering" | "shell" | "glazing";
                    thickness: number;
                    core?: true | undefined;
                    material?: string | undefined;
                    slot?: string | undefined;
                    returns?: boolean | undefined;
                    display?: "construction" | "finished" | undefined;
                    inset?: number | undefined;
                    bottom?: number | undefined;
                    lift?: number | undefined;
                    src?: string | undefined;
                }[];
                backing?: {
                    id: string;
                    role: "fill" | "finish" | "lining" | "substrate" | "sheathing" | "membrane" | "underlay" | "insulation" | "air" | "furring" | "structure" | "deck" | "covering" | "shell" | "glazing";
                    thickness: number;
                    core?: true | undefined;
                    material?: string | undefined;
                    slot?: string | undefined;
                    returns?: boolean | undefined;
                    display?: "construction" | "finished" | undefined;
                    inset?: number | undefined;
                    bottom?: number | undefined;
                    lift?: number | undefined;
                    src?: string | undefined;
                }[] | undefined;
                face?: "front" | "exterior" | undefined;
                presetId?: string | undefined;
                cavityInsulation?: string | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `rseg_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            children: string[];
            roofType: "flat" | "hip" | "gable" | "shed" | "gambrel" | "dutch" | "mansard" | "conical";
            width: number;
            depth: number;
            trim: {
                left: number;
                right: number;
                front: number;
                back: number;
                frontLeft: number;
                frontRight: number;
                backLeft: number;
                backRight: number;
                frontLeftX: number;
                frontLeftZ: number;
                frontRightX: number;
                frontRightZ: number;
                backLeftX: number;
                backLeftZ: number;
                backRightX: number;
                backRightZ: number;
            };
            wallHeight: number;
            pitch: number;
            wallThickness: number;
            deckThickness: number;
            overhang: number;
            shingleThickness: number;
            managedByParent: boolean;
            wallShell: "omit" | "auto" | "include";
            shedInsetEndPanels: boolean;
            gambrelLowerWidthRatio: number;
            gambrelLowerHeightRatio: number;
            mansardSteepWidthRatio: number;
            mansardSteepHeightRatio: number;
            dutchHipWidthRatio: number;
            dutchHipHeightRatio: number;
            dutchWaistLengthRatio: number;
            dutchGabletRake: number;
            dutchTopRakeThickness: number;
            type: "roof-segment";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            topMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            topMaterialPreset?: string | undefined;
            edgeMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            edgeMaterialPreset?: string | undefined;
            wallMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            wallMaterialPreset?: string | undefined;
            conicalStartAngle?: number | undefined;
            conicalSweepAngle?: number | undefined;
            conicalFullCircle?: boolean | undefined;
            arc?: {
                centerX: number;
                centerZ: number;
                radius: number;
            } | undefined;
            shedSideInfillSpan?: number | undefined;
            shedSideInfillMinX?: number | undefined;
            shedSideInfillMaxX?: number | undefined;
            shedFootprintPieces?: [number, number][][] | undefined;
            shedOpenEndSides?: ("left" | "right")[] | undefined;
            shedJointFrame?: {
                position: [number, number, number];
                rotation: number;
            } | undefined;
            shedJointOwnerId?: string | undefined;
            shedJointNeighborIds?: string[] | undefined;
            shedJointScopeId?: string | undefined;
            fascia?: boolean | undefined;
            fasciaHighEdge?: boolean | undefined;
        } | {
            object: "node";
            style: "wall-shelf" | "bookshelf" | "open-rack" | "cubby";
            metadata: Record<string, unknown>;
            id: `shelf_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            children: string[];
            thickness: number;
            width: number;
            depth: number;
            rows: number;
            height: number;
            columns: number;
            withBack: boolean;
            withSides: boolean;
            withBottom: boolean;
            bracketStyle: "hidden" | "minimal" | "industrial";
            type: "shelf";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            slots?: Record<string, string> | undefined;
            supportSlabId?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `stair_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            children: `sseg_${string}`[];
            thickness: number;
            width: number;
            fromLevelId: string | null;
            toLevelId: string | null;
            stairType: "curved" | "straight" | "spiral";
            slabOpeningMode: "none" | "destination";
            openingOffset: number;
            stepCount: number;
            fillToFloor: boolean;
            innerRadius: number;
            sweepAngle: number;
            topLandingMode: "none" | "integrated";
            topLandingDepth: number;
            showCenterColumn: boolean;
            showStepSupports: boolean;
            railingMode: "left" | "right" | "none" | "both";
            railingHeight: number;
            type: "stair";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            slots?: Record<string, string> | undefined;
            supportSlabId?: string | undefined;
            railingMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            railingMaterialPreset?: string | undefined;
            treadMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            treadMaterialPreset?: string | undefined;
            sideMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            sideMaterialPreset?: string | undefined;
            deckSlabId?: string | undefined;
            totalRise?: number | undefined;
            railingStyle?: "balusters" | "cable" | "boards" | "post-and-rail" | undefined;
            railingTopPost?: boolean | undefined;
            railingTopReach?: number | undefined;
            railingPostThrough?: boolean | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `sseg_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            thickness: number;
            width: number;
            height: number;
            stepCount: number;
            fillToFloor: boolean;
            segmentType: "stair" | "landing";
            length: number;
            attachmentSide: "front" | "left" | "right";
            type: "stair-segment";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `scan_${string}`;
            opacity: number;
            url: string | null;
            scale: number;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            layers: Record<string, boolean>;
            captureSession: {
                sessionId: string;
                schemaVersion?: number | undefined;
                revisionId?: string | undefined;
                manifestUrl?: string | undefined;
            } | null;
            type: "scan";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `guide_${string}`;
            opacity: number;
            url: string;
            scale: number;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            scaleReference: {
                start: [number, number];
                end: [number, number];
                realLengthMeters: number;
                measuredLengthUnits: number;
                metersPerUnit: number;
                label: string;
            } | null;
            type: "guide";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `measurement_${string}`;
            parentId: string | null;
            visible: boolean;
            measurement: {
                kind: "distance";
                points: [[number, number, number] | {
                    kind: "feature";
                    reference: {
                        nodeId: string;
                        featureId: string;
                        parameters?: Record<string, string | number | boolean> | undefined;
                    };
                    fallback: [number, number, number];
                }, [number, number, number] | {
                    kind: "feature";
                    reference: {
                        nodeId: string;
                        featureId: string;
                        parameters?: Record<string, string | number | boolean> | undefined;
                    };
                    fallback: [number, number, number];
                }];
            } | {
                kind: "angle";
                points: [[number, number, number] | {
                    kind: "feature";
                    reference: {
                        nodeId: string;
                        featureId: string;
                        parameters?: Record<string, string | number | boolean> | undefined;
                    };
                    fallback: [number, number, number];
                }, [number, number, number] | {
                    kind: "feature";
                    reference: {
                        nodeId: string;
                        featureId: string;
                        parameters?: Record<string, string | number | boolean> | undefined;
                    };
                    fallback: [number, number, number];
                }, [number, number, number] | {
                    kind: "feature";
                    reference: {
                        nodeId: string;
                        featureId: string;
                        parameters?: Record<string, string | number | boolean> | undefined;
                    };
                    fallback: [number, number, number];
                }];
            } | {
                kind: "area";
                base: ([number, number, number] | {
                    kind: "feature";
                    reference: {
                        nodeId: string;
                        featureId: string;
                        parameters?: Record<string, string | number | boolean> | undefined;
                    };
                    fallback: [number, number, number];
                })[];
            } | {
                kind: "perimeter";
                base: ([number, number, number] | {
                    kind: "feature";
                    reference: {
                        nodeId: string;
                        featureId: string;
                        parameters?: Record<string, string | number | boolean> | undefined;
                    };
                    fallback: [number, number, number];
                })[];
            } | {
                kind: "volume";
                base: ([number, number, number] | {
                    kind: "feature";
                    reference: {
                        nodeId: string;
                        featureId: string;
                        parameters?: Record<string, string | number | boolean> | undefined;
                    };
                    fallback: [number, number, number];
                })[];
                extrusion: [number, number, number];
            };
            type: "measurement";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `spawn_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            type: "spawn";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            supportSlabId?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `window_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            width: number;
            height: number;
            operationState: number;
            constructionType: "framed" | "masonry";
            dimensionReference: "nominal" | "rough-opening" | "masonry-opening" | "finish-opening";
            openingKind: "window" | "opening";
            windowType: "fixed" | "sliding" | "casement" | "awning" | "hopper" | "single-hung" | "double-hung" | "bay" | "bow" | "louvered";
            awningDirection: "up" | "down";
            casementStyle: "single" | "french";
            hingesSide: "left" | "right";
            openingShape: "rounded" | "rectangle" | "arch";
            openingRadiusMode: "all" | "individual";
            openingCornerRadii: [number, number, number, number];
            cornerRadius: number;
            archHeight: number;
            openingRevealRadius: number;
            frameThickness: number;
            frameDepth: number;
            columnRatios: number[];
            rowRatios: number[];
            columnDividerThickness: number;
            rowDividerThickness: number;
            sill: boolean;
            sillDepth: number;
            sillThickness: number;
            type: "window";
            mark?: string | undefined;
            side?: "front" | "back" | undefined;
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            roofSegmentId?: string | undefined;
            wallId?: string | undefined;
            roofFace?: "front" | "back" | "left" | "right" | undefined;
            dormerId?: string | undefined;
            dormerFace?: "front" | "back" | "left" | "right" | undefined;
            roughOpeningWidth?: number | undefined;
            roughOpeningHeight?: number | undefined;
            masonryOpeningWidth?: number | undefined;
            masonryOpeningHeight?: number | undefined;
            finishOpeningWidth?: number | undefined;
            finishOpeningHeight?: number | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `door_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            width: number;
            height: number;
            leafCount: 1 | 2 | 3 | 4;
            operationState: number;
            doorType: "double" | "sliding" | "french" | "hinged" | "folding" | "pocket" | "barn" | "garage-sectional" | "garage-rollup" | "garage-tiltup";
            constructionType: "framed" | "masonry";
            dimensionReference: "nominal" | "rough-opening" | "masonry-opening" | "finish-opening";
            openingKind: "door" | "opening";
            hingesSide: "left" | "right";
            openingShape: "rounded" | "rectangle" | "arch";
            openingRadiusMode: "all" | "individual";
            cornerRadius: number;
            archHeight: number;
            openingRevealRadius: number;
            frameThickness: number;
            frameDepth: number;
            doorCategory: "interior" | "garage";
            slideDirection: "left" | "right";
            trackStyle: "visible" | "none" | "pocket" | "overhead";
            garagePanelCount: number;
            openingTopRadii: [number, number];
            threshold: boolean;
            thresholdHeight: number;
            swingDirection: "inward" | "outward";
            swingAngle: number;
            segments: {
                type: "glass" | "empty" | "panel";
                heightRatio: number;
                columnRatios: number[];
                dividerThickness: number;
                panelDepth: number;
                panelInset: number;
            }[];
            handle: boolean;
            handleHeight: number;
            handleSide: "left" | "right";
            contentPadding: [number, number];
            doorCloser: boolean;
            panicBar: boolean;
            panicBarHeight: number;
            type: "door";
            mark?: string | undefined;
            side?: "front" | "back" | undefined;
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            roofSegmentId?: string | undefined;
            wallId?: string | undefined;
            roofFace?: "front" | "back" | "left" | "right" | undefined;
            roughOpeningWidth?: number | undefined;
            roughOpeningHeight?: number | undefined;
            masonryOpeningWidth?: number | undefined;
            masonryOpeningHeight?: number | undefined;
            finishOpeningWidth?: number | undefined;
            finishOpeningHeight?: number | undefined;
        } | {
            object: "node";
            style: "box" | "cap" | "dome";
            metadata: Record<string, unknown>;
            id: `bvent_${string}`;
            parentId: string | null;
            visible: boolean;
            materialPreset: string;
            position: [number, number, number];
            rotation: number;
            width: number;
            depth: number;
            height: number;
            baseHeight: number;
            hoodOverhang: number;
            topTaper: number;
            capHeight: number;
            capGap: number;
            domeCurvature: number;
            baseInset: number;
            cornerBevel: number;
            type: "box-vent";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            roofSegmentId?: string | undefined;
        } | {
            object: "node";
            style: "metal" | "standard" | "shingled";
            metadata: Record<string, unknown>;
            id: `rvent_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            width: number;
            height: number;
            length: number;
            endCaps: boolean;
            type: "ridge-vent";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            roofSegmentId?: string | undefined;
        } | {
            object: "node";
            style: "cylinder" | "globe";
            metadata: Record<string, unknown>;
            id: `tvent_${string}`;
            parentId: string | null;
            visible: boolean;
            materialPreset: string;
            position: [number, number, number];
            rotation: number;
            height: number;
            diameter: number;
            neckHeight: number;
            baseOverhang: number;
            vaneCount: number;
            spinSpeed: number;
            type: "turbine-vent";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            roofSegmentId?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `cupola_${string}`;
            parentId: string | null;
            visible: boolean;
            materialPreset: string;
            position: [number, number, number];
            rotation: number;
            width: number;
            depth: number;
            height: number;
            roofStyle: "pyramid" | "dome";
            finial: boolean;
            type: "cupola";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            roofSegmentId?: string | undefined;
        } | {
            object: "node";
            style: "half-round" | "scoop" | "slant-box";
            metadata: Record<string, unknown>;
            id: `eyebrow-vent_${string}`;
            parentId: string | null;
            visible: boolean;
            materialPreset: string;
            position: [number, number, number];
            rotation: number;
            width: number;
            depth: number;
            height: number;
            louverCount: number;
            backRatio: number;
            type: "eyebrow-vent";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            roofSegmentId?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `gutter_${string}`;
            parentId: string | null;
            visible: boolean;
            materialPreset: string;
            position: [number, number, number];
            rotation: number;
            thickness: number;
            profile: "box" | "k-style" | "half-round";
            length: number;
            size: number;
            endCapLeft: boolean;
            endCapRight: boolean;
            hangerStyle: "none" | "strap";
            hangerSpacing: number;
            outlets: {
                id: string;
                offset: number;
                diameter: number;
                generatedBy?: "default-downspout" | undefined;
            }[];
            type: "gutter";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            roofSegmentId?: string | undefined;
            arc?: {
                centerX: number;
                centerZ: number;
                radius: number;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `chimney_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            width: number;
            depth: number;
            panelDepth: number;
            cornerBevel: number;
            cap: boolean;
            bodyShape: "round" | "square";
            bodyHollowDepth: number;
            bodyHollowMargin: number;
            heightAboveRidge: number;
            cutoutOffset: number;
            capShape: "flat" | "none" | "stepped" | "sloped";
            capOverhang: number;
            capThickness: number;
            flueCount: number;
            flueShape: "round" | "square";
            flueHeight: number;
            flueDiameter: number;
            flueSpacing: number;
            flueWallThickness: number;
            shoulderStyle: "none" | "tapered" | "corbeled";
            shoulderHeight: number;
            shoulderExtent: number;
            bandStyle: "single" | "double" | "none";
            bandHeight: number;
            bandExtent: number;
            bandOffset: number;
            cricketStyle: "none" | "simple";
            cricketLength: number;
            cricketHeight: number;
            cricketSide: "front" | "back";
            panelStyle: "none" | "rectangular";
            panelHeight: number;
            panelOffsetTop: number;
            panelMargin: number;
            type: "chimney";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            topMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            topMaterialPreset?: string | undefined;
            roofSegmentId?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `solarpanel_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            rows: number;
            columns: number;
            frameThickness: number;
            frameDepth: number;
            panelHeight: number;
            panelWidth: number;
            gapX: number;
            gapY: number;
            mountingType: "flush" | "tilted";
            tiltAngle: number;
            standoffHeight: number;
            type: "solar-panel";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            roofSegmentId?: string | undefined;
            panelMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            panelMaterialPreset?: string | undefined;
            panelTypePreset?: "residential" | "residential-large" | "compact" | "frameless" | undefined;
            surfaceNormal?: [number, number, number] | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `skylight_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            curbHeight: number;
            width: number;
            height: number;
            glassThickness: number;
            operationState: number;
            frameThickness: number;
            frameDepth: number;
            slideDirection: "x" | "z";
            cutoutOffset: number;
            skylightType: "flat" | "opening" | "sliding" | "walk-on" | "lantern";
            lanternHeight: number;
            lanternTopScale: number;
            openingAngle: number;
            openingSide: "bottom" | "top" | "left" | "right";
            motorHousing: boolean;
            slideFraction: number;
            trackWidth: number;
            motorHousingSize: number;
            curb: boolean;
            type: "skylight";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            roofSegmentId?: string | undefined;
            surfaceNormal?: [number, number, number] | undefined;
            glassMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            glassMaterialPreset?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `dormer_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            children: `window_${string}`[];
            roofType: "flat" | "hip" | "gable" | "shed" | "gambrel" | "dutch" | "mansard" | "conical";
            width: number;
            depth: number;
            height: number;
            roofHeight: number;
            shedHighSide: "front" | "back";
            wallSkirtHeight: number;
            windowWidth: number;
            windowHeight: number;
            windowOffsetX: number;
            windowOffsetY: number;
            windowFrameThickness: number;
            windowFrameDepth: number;
            windowColumns: number;
            windowRows: number;
            windowDividerThickness: number;
            windowShape: "rounded" | "rectangle" | "arch";
            windowArchHeight: number;
            windowCornerRadii: [number, number, number, number];
            windowSill: boolean;
            windowSillDepth: number;
            windowSillThickness: number;
            type: "dormer";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            materialPreset?: string | undefined;
            topMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            topMaterialPreset?: string | undefined;
            wallMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            wallMaterialPreset?: string | undefined;
            roofSegmentId?: string | undefined;
            sideMaterial?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            sideMaterialPreset?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `downspout_${string}`;
            parentId: string | null;
            visible: boolean;
            materialPreset: string;
            shape: "rect" | "auto" | "round";
            diameter: number;
            length: number;
            standoff: number;
            strapStyle: "none" | "band";
            strapSpacing: number;
            terminal: "straight" | "splash" | "kickout";
            type: "downspout";
            material?: {
                id?: string | undefined;
                preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
                properties?: {
                    color: string;
                    roughness: number;
                    metalness: number;
                    opacity: number;
                    transparent: boolean;
                    side: "front" | "back" | "double";
                } | undefined;
                texture?: {
                    url: string;
                    repeat?: [number, number] | undefined;
                    scale?: number | undefined;
                } | undefined;
            } | undefined;
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            gutterId?: string | undefined;
            outletId?: string | undefined;
            lengthMode?: "manual" | "to-ground" | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            path: [number, number, number][];
            id: `duct-segment_${string}`;
            parentId: string | null;
            visible: boolean;
            width: number;
            shape: "rect" | "round" | "oval";
            height: number;
            diameter: number;
            roll: number;
            ductMaterial: "spiral" | "sheet-metal" | "flex" | "duct-board";
            seamDetail: boolean;
            insulated: boolean;
            insulationR: number;
            system: "supply" | "return";
            type: "duct-segment";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            hangerStyle?: "single" | "double" | undefined;
            hangerSpacing?: number | undefined;
            autoHangers?: boolean | undefined;
            hangerOverrides?: Record<string, {
                fraction?: number | undefined;
                skipped?: boolean | undefined;
                hostId?: string | undefined;
            }> | undefined;
            hangerMaxReach?: number | undefined;
            wallAttachment?: {
                wallId: `wall_${string}`;
                side: "front" | "back";
                startUV: [number, number];
                endUV: [number, number];
                offset: number;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `duct-fitting_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            width: number;
            shape: "rect" | "round" | "oval";
            height: number;
            diameter: number;
            panelHeight: number;
            panelWidth: number;
            ductMaterial: "sheet-metal" | "flex" | "duct-board";
            system: "supply" | "return";
            fittingType: "elbow" | "tee" | "cross" | "reducer" | "transition" | "end-cap" | "damper" | "access-panel" | "coupling";
            shape2: "rect" | "round" | "oval";
            width2: number;
            height2: number;
            angle: number;
            branchAngle: number;
            diameter2: number;
            damperAngle: number;
            type: "duct-fitting";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            slots?: Record<string, string> | undefined;
            inletShape?: "rect" | "round" | "oval" | undefined;
            outletShape?: "rect" | "round" | "oval" | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `duct-terminal_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            width: number;
            depth: number;
            terminalType: "supply-register" | "diffuser" | "return-grille";
            mount: "wall" | "ceiling" | "floor";
            collarShape: "rect" | "round" | "oval";
            collarDiameter: number;
            collarWidth: number;
            collarHeight: number;
            type: "duct-terminal";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            supportSlabId?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `hvac-equipment_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            width: number;
            depth: number;
            height: number;
            equipmentType: "furnace" | "air-handler" | "condenser";
            supplyShape: "rect" | "round" | "oval";
            returnShape: "rect" | "round" | "oval";
            supplyDiameter: number;
            returnDiameter: number;
            supplyWidth: number;
            supplyHeight: number;
            returnWidth: number;
            returnHeight: number;
            type: "hvac-equipment";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            supportSlabId?: string | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            path: [number, number, number][];
            id: `lineset_${string}`;
            parentId: string | null;
            visible: boolean;
            insulated: boolean;
            suctionDiameter: number;
            liquidDiameter: number;
            type: "lineset";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            path: [number, number, number][];
            id: `liquid-line_${string}`;
            parentId: string | null;
            visible: boolean;
            diameter: number;
            type: "liquid-line";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            path: [number, number, number][];
            id: `pipe-segment_${string}`;
            parentId: string | null;
            visible: boolean;
            diameter: number;
            system: "waste" | "vent";
            pipeMaterial: "abs" | "pvc" | "cast-iron";
            type: "pipe-segment";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
            hangerStyle?: "single" | "double" | undefined;
            hangerSpacing?: number | undefined;
            autoHangers?: boolean | undefined;
            hangerOverrides?: Record<string, {
                fraction?: number | undefined;
                skipped?: boolean | undefined;
                hostId?: string | undefined;
            }> | undefined;
            hangerMaxReach?: number | undefined;
            wallAttachment?: {
                wallId: `wall_${string}`;
                side: "front" | "back";
                startUV: [number, number];
                endUV: [number, number];
                offset: number;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `pipe-fitting_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: [number, number, number];
            diameter: number;
            system: "waste" | "vent";
            fittingType: "elbow" | "cross" | "reducer" | "end-cap" | "coupling" | "wye" | "sanitary-tee" | "cleanout";
            angle: number;
            diameter2: number;
            pipeMaterial: "abs" | "pvc" | "cast-iron";
            cleanoutStyle: "end" | "inline";
            type: "pipe-fitting";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        } | {
            object: "node";
            metadata: Record<string, unknown>;
            id: `pipe-trap_${string}`;
            parentId: string | null;
            visible: boolean;
            position: [number, number, number];
            rotation: number;
            diameter: number;
            pipeMaterial: "abs" | "pvc" | "cast-iron";
            armLengthM: number;
            type: "pipe-trap";
            name?: string | undefined;
            camera?: {
                position: [number, number, number];
                target: [number, number, number];
                mode: "perspective" | "orthographic";
                fov?: number | undefined;
                zoom?: number | undefined;
            } | undefined;
            provenance?: {
                refs: {
                    id: string;
                    ns?: string | undefined;
                    role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
                }[];
                lineage?: {
                    op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                    fromIds: string[];
                } | undefined;
            } | undefined;
        };
        parentId: `roof_${string}` | `rseg_${string}` | `site_${string}` | `building_${string}` | `level_${string}` | `elevator_${string}` | `unit_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}` | `leanto_${string}` | `door_${string}` | `window_${string}` | `cabinet_${string}` | `cabinet-module_${string}` | `sseg_${string}` | `bvent_${string}` | `rvent_${string}` | `tvent_${string}` | `cupola_${string}` | `eyebrow-vent_${string}` | `gutter_${string}` | `chimney_${string}` | `solarpanel_${string}` | `skylight_${string}` | `dormer_${string}` | `downspout_${string}` | undefined;
    }[];
    newLevelId: `roof_${string}` | `rseg_${string}` | `site_${string}` | `building_${string}` | `level_${string}` | `elevator_${string}` | `unit_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}` | `leanto_${string}` | `door_${string}` | `window_${string}` | `cabinet_${string}` | `cabinet-module_${string}` | `sseg_${string}` | `bvent_${string}` | `rvent_${string}` | `tvent_${string}` | `cupola_${string}` | `eyebrow-vent_${string}` | `gutter_${string}` | `chimney_${string}` | `solarpanel_${string}` | `skylight_${string}` | `dormer_${string}` | `downspout_${string}`;
    shiftedLevels: {
        id: `level_${string}`;
        level: number;
    }[];
};
//# sourceMappingURL=level-duplication.d.ts.map