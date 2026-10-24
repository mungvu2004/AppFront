/**
 * Durable skirt: Pascal mỗi tường chỉ một `skirting` (một cỡ cho cả hai mặt), nên tường bao
 * không thể vừa có len trong nhà (0,1 m) vừa có phào chân ngoài (0,25 m). Luật này thêm
 * `skirting.exterior` tuỳ chọn (cỡ/kiểu riêng cho mặt ngoài) vào schema và cho renderer dùng nó
 * khi vẽ mặt `exterior`. Node đã lưu không có trường này → vẽ như cũ.
 * AppFront đặt nó ở `exteriorSkirtingOf` (src/lib/pascal/toPascal.ts).
 */
export const RULES = {
  'core/src/schema/nodes/wall.ts': [
    [
      '\n  offsetY: z.number().optional(),\n})\nexport type WallTrimConfig',
      '\n  offsetY: z.number().optional(),\n  exterior: z.object({ height: z.number(), proud: z.number(), profile: WallTrimProfile }).partial().optional(),\n})\nexport type WallTrimConfig',
      1,
    ],
  ],
  'nodes/src/wall/treatments.tsx': [
    // Lát cắt tường cũng phải biết độ nhô của mặt ngoài (thụt 4 = wallTreatmentProudOffsets).
    [
      "\n    ['skirting', node.skirting],",
      "\n    ['skirting', node.skirting],\n    ['skirting', node.skirting?.exterior ? { ...node.skirting, ...node.skirting.exterior } : undefined],",
      1,
    ],
    [
      'const geometry = buildTrimGeometry(node, side, trim, kind, childrenNodes, levelData)',
      "const geometry = buildTrimGeometry(node, side, side === 'exterior' && trim.exterior ? { ...trim, ...trim.exterior } : trim, kind, childrenNodes, levelData)",
      1,
    ],
  ],
};
