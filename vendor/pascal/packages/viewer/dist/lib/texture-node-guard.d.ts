/**
 * three's node system pulls texture uniforms from materials each frame via
 * reference nodes, and several override-material passes (shadow, depth/normal
 * prepasses) copy per-object texture slots onto shared materials whose cached
 * per-mesh node graphs can disagree about a slot's presence. When they do,
 * `TextureNode.update` dereferences a null texture and the exception kills the
 * whole render pass — the scene goes black. Substitute a 1×1 black fallback
 * instead (skipping is not enough: the null would still reach the backend's
 * texture-binding WeakMap). The slot renders black for a frame and recovers
 * as soon as the reference pulls a real value again.
 */
export declare function installTextureNodeNullGuard(): void;
//# sourceMappingURL=texture-node-guard.d.ts.map