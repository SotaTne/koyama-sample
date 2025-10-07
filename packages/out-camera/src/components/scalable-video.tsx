"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";

type TapPayload = { x: number; y: number; imageData: ImageData };

type CameraLayout = {
  cw: number;
  ch: number;
  dpr: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

type Props = {
  stream: MediaStream;
  width?: number | string;
  height?: number | string;
  className?: string;
  overscan?: number;
  onTap?: (data: TapPayload) => void;
};

const VS_300 = `#version 300 es
precision highp float;
uniform vec4 u_uvRect;
out vec2 v_uv;
void main() {
  vec2 pos = (gl_VertexID == 0) ? vec2(-1.0, -1.0)
            : (gl_VertexID == 1) ? vec2( 3.0, -1.0)
                                  : vec2(-1.0,  3.0);
  gl_Position = vec4(pos, 0.0, 1.0);
  vec2 base = pos * 0.5 + 0.5;
  v_uv = mix(u_uvRect.xy, u_uvRect.zw, base);
}`;

const FS_300 = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  outColor = texture(u_texture, v_uv);
}`;

export function WebGLCanvasCamera({
  stream,
  width = "100%",
  height = "100%",
  className = "",
  overscan = 1.0,
  onTap,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const vaoRef = useRef<WebGLVertexArrayObject | null>(null);
  const texRef = useRef<WebGLTexture | null>(null);
  const uUVRectRef = useRef<WebGLUniformLocation | null>(null);

  const captureFBORef = useRef<WebGLFramebuffer | null>(null);
  const captureTexRef = useRef<WebGLTexture | null>(null);
  const captureSizeRef = useRef<{ w: number; h: number } | null>(null);

  const [meta, setMeta] = useState<{ vw: number; vh: number } | null>(null);
  const layoutRef = useRef<CameraLayout | null>(null);
  const lastUVRef = useRef<{ u0: number; v0: number; u1: number; v1: number } | null>(null);
  const cachedRef = useRef({ cw: 0, ch: 0, dpr: 1 });
  const pixRef = useRef({ w: 0, h: 0 });
  const allocTexRef = useRef<{ w: number; h: number } | null>(null);
  const isRenderingRef = useRef(true);
  const contextLostRef = useRef(false);

  // Compile & link helpers
  const compileShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const sh = gl.createShader(type);
    if (!sh) throw new Error("Failed to create shader");
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) || "(empty)";
      gl.deleteShader(sh);
      throw new Error(`Shader compile failed: ${log}`);
    }
    return sh;
  };

  const linkProgram = (gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader) => {
    const prog = gl.createProgram();
    if (!prog) throw new Error("Failed to create program");
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) || "(empty)";
      gl.deleteProgram(prog);
      throw new Error(`Program link failed: ${log}`);
    }
    return prog;
  };

  // Layout
  const calcLayout = useCallback(
    (vw: number, vh: number, cw: number, ch: number, dpr: number, ovVal: number): CameraLayout => {
      const ov = Math.max(1, ovVal);
      const rc = cw / ch;
      const rv = vw / vh;
      let sx = 0, sy = 0, sw = vw, sh = vh;

      if (rv > rc) {
        sw = vh * rc;
        sx = (vw - sw) * 0.5;
      } else {
        sh = vw / rc;
        sy = (vh - sh) * 0.5;
      }

      const osw = sw / ov;
      const osh = sh / ov;
      sx += (sw - osw) * 0.5;
      sy += (sh - osh) * 0.5;

      return { cw, ch, dpr, sx, sy, sw: osw, sh: osh };
    },
    []
  );

  // Update UV (no gl.useProgram here)
  const updateUV = useCallback(
    (gl: WebGL2RenderingContext, L: CameraLayout, vw: number, vh: number) => {
      if (!uUVRectRef.current) return;
      const invW = 1 / vw;
      const invH = 1 / vh;
      const u0 = L.sx * invW;
      const u1 = (L.sx + L.sw) * invW;
      const v0 = 1.0 - L.sy * invH;
      const v1 = 1.0 - (L.sy + L.sh) * invH;

      const last = lastUVRef.current;
      if (last && last.u0 === u0 && last.v0 === v0 && last.u1 === u1 && last.v1 === v1) return;

      gl.uniform4f(uUVRectRef.current, u0, v0, u1, v1);
      lastUVRef.current = { u0, v0, u1, v1 };
    },
    []
  );

  // WebGL2 init
  const initGL2 = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Canvas not found");

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null;

    if (!gl) throw new Error("WebGL2 not supported");
    if (gl.isContextLost()) throw new Error("Context lost at init");

    glRef.current = gl;
    contextLostRef.current = false;

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // Disable implicit color conversion (best-effort; some UAs ignore).
    try {
      (gl as any).pixelStorei((gl as any).UNPACK_COLORSPACE_CONVERSION_WEBGL, (gl as any).NONE);
    } catch {}

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);

    const vs = compileShader(gl, gl.VERTEX_SHADER, VS_300);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_300);
    const prog = linkProgram(gl, vs, fs);
    progRef.current = prog;

    gl.useProgram(prog);
    const uTex = gl.getUniformLocation(prog, "u_texture");
    uUVRectRef.current = gl.getUniformLocation(prog, "u_uvRect");
    if (!uTex || !uUVRectRef.current) throw new Error("Uniform locations not found");
    gl.uniform1i(uTex, 0);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create VAO");
    vaoRef.current = vao;
    gl.bindVertexArray(vao);
    gl.bindVertexArray(null);
  }, []);

  // Context loss
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;

    const onLost = (e: Event) => {
      e.preventDefault();
      contextLostRef.current = true;
      const gl = glRef.current;
      if (gl) {
        if (texRef.current) gl.deleteTexture(texRef.current);
        if (captureTexRef.current) gl.deleteTexture(captureTexRef.current);
        if (captureFBORef.current) gl.deleteFramebuffer(captureFBORef.current);
      }
      texRef.current = null;
      allocTexRef.current = null;
      captureTexRef.current = null;
      captureFBORef.current = null;
      captureSizeRef.current = null;
      lastUVRef.current = null;
    };

    const onRestored = () => {
      contextLostRef.current = false;
      texRef.current = null;
      allocTexRef.current = null;
      captureTexRef.current = null;
      captureFBORef.current = null;
      captureSizeRef.current = null;
      lastUVRef.current = null;
      initGL2();
    };

    cvs.addEventListener("webglcontextlost", onLost);
    cvs.addEventListener("webglcontextrestored", onRestored);
    return () => {
      cvs.removeEventListener("webglcontextlost", onLost);
      cvs.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [initGL2]);

  // Mount/cleanup
  useEffect(() => {
    initGL2();
    return () => {
      const gl = glRef.current;
      if (!gl) return;
      if (progRef.current) gl.deleteProgram(progRef.current);
      if (texRef.current) gl.deleteTexture(texRef.current);
      if (vaoRef.current) gl.deleteVertexArray(vaoRef.current);
      if (captureTexRef.current) gl.deleteTexture(captureTexRef.current);
      if (captureFBORef.current) gl.deleteFramebuffer(captureFBORef.current);

      texRef.current = null;
      vaoRef.current = null;
      progRef.current = null;
      captureTexRef.current = null;
      captureFBORef.current = null;
      captureSizeRef.current = null;
      glRef.current = null;
    };
  }, [initGL2]);

  // MediaStream
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;
    v.autoplay = true;

    const onMeta = () => {
      if (v.videoWidth && v.videoHeight) setMeta({ vw: v.videoWidth, vh: v.videoHeight });
    };
    const onCanPlay = () => v.play().catch(() => {});
    const onEnded = () => (isRenderingRef.current = false);

    const tracks = stream.getVideoTracks();
    tracks.forEach((t) => t.addEventListener("ended", onEnded));

    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("loadeddata", onMeta);
    v.addEventListener("canplay", onCanPlay);

    if (v.readyState >= HTMLMediaElement.HAVE_METADATA && v.videoWidth && v.videoHeight) {
      setMeta({ vw: v.videoWidth, vh: v.videoHeight });
      v.play().catch(() => {});
    }
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("loadeddata", onMeta);
      v.removeEventListener("canplay", onCanPlay);
      tracks.forEach((t) => t.removeEventListener("ended", onEnded));
    };
  }, [stream]);

  // Resize observer
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !meta) return;
    const gl = glRef.current;
    if (!gl) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = Math.max(1, entry.contentRect.width);
        const ch = Math.max(1, entry.contentRect.height);
        const dpr = window.devicePixelRatio || 1;

        const cached = cachedRef.current;
        if (cached.cw === cw && cached.ch === ch && cached.dpr === dpr) continue;

        cachedRef.current = { cw, ch, dpr };

        const W = Math.round(cw * dpr);
        const H = Math.round(ch * dpr);
        const cvs = canvasRef.current!;
        if (pixRef.current.w !== W || pixRef.current.h !== H) {
          cvs.width = W;
          cvs.height = H;
          cvs.style.width = `${cw}px`;
          cvs.style.height = `${ch}px`;
          gl.viewport(0, 0, W, H);
          pixRef.current = { w: W, h: H };
        }

        const L = calcLayout(meta.vw, meta.vh, cw, ch, dpr, overscan);
        layoutRef.current = L;

        // Ensure correct program bound at least once (init & render will bind too)
        gl.useProgram(progRef.current!);
        updateUV(gl, L, meta.vw, meta.vh);
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [meta, overscan, calcLayout, updateUV]);

  // Initial layout
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !meta) return;
    const { cw, ch, dpr } = cachedRef.current;
    if (cw > 0 && ch > 0) {
      const L = calcLayout(meta.vw, meta.vh, cw, ch, dpr, overscan);
      layoutRef.current = L;
      gl.useProgram(progRef.current!);
      updateUV(gl, L, meta.vw, meta.vh);
    }
  }, [meta, overscan, calcLayout, updateUV]);

  // Render
  const render = useCallback(() => {
    if (!isRenderingRef.current || contextLostRef.current) return;

    const gl = glRef.current!;
    const v = videoRef.current!;
    const prog = progRef.current!;
    const vao = vaoRef.current!;
    if (!meta || !layoutRef.current) return;
    if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (gl.isContextLost()) {
      contextLostRef.current = true;
      return;
    }

    // Allocate/resize video texture only when needed
    const sizeChanged =
      !allocTexRef.current ||
      allocTexRef.current.w !== v.videoWidth ||
      allocTexRef.current.h !== v.videoHeight;

    if (sizeChanged || !texRef.current) {
      if (texRef.current) gl.deleteTexture(texRef.current);
      const tex = gl.createTexture();
      if (!tex) return;
      texRef.current = tex;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      try {
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, v.videoWidth, v.videoHeight);
      } catch {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, v.videoWidth, v.videoHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      allocTexRef.current = { w: v.videoWidth, h: v.videoHeight };
    } else {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texRef.current);
    }

    // Upload frame
    try {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, v);
    } catch {
      if (texRef.current) gl.deleteTexture(texRef.current);
      texRef.current = null;
      allocTexRef.current = null;
      return;
    }

    // Draw
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }, [meta]);

  // Render loop
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let stop = false;
    let raf = 0;
    isRenderingRef.current = true;

    const step = () => {
      if (stop) return;
      render();
      (v as any).requestVideoFrameCallback(step);
    };
    if ("requestVideoFrameCallback" in v) {
      (v as any).requestVideoFrameCallback(step);
    } else {
      const tick = () => {
        if (stop) return;
        render();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      stop = true;
      isRenderingRef.current = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [render]);

  // Capture target
  const ensureCaptureTarget = (gl: WebGL2RenderingContext, w: number, h: number) => {
    const need =
      !captureSizeRef.current ||
      captureSizeRef.current.w !== w ||
      captureSizeRef.current.h !== h;
    if (!need) return;

    if (captureTexRef.current) gl.deleteTexture(captureTexRef.current);
    if (captureFBORef.current) gl.deleteFramebuffer(captureFBORef.current);

    const tex = gl.createTexture()!;
    captureTexRef.current = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // NEAREST is enough for offscreen capture
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    try {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    } catch {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    const fbo = gl.createFramebuffer()!;
    captureFBORef.current = fbo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      captureTexRef.current = null;
      captureFBORef.current = null;
      captureSizeRef.current = null;
      throw new Error("Capture FBO incomplete");
    }
    captureSizeRef.current = { w, h };
  };

  // Snapshot → ImageData
  const makeSnapshotImageData = useCallback((): ImageData | null => {
    const gl = glRef.current;
    const v = videoRef.current;
    const L = layoutRef.current;
    const prog = progRef.current;
    const vao = vaoRef.current;
    const tex = texRef.current;
    if (!gl || !v || !L || !prog || !vao || !tex) return null;

    const w = Math.round(L.cw * L.dpr);
    const h = Math.round(L.ch * L.dpr);
    ensureCaptureTarget(gl, w, h);

    // Save state
    const prevFB = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const prevVP = gl.getParameter(gl.VIEWPORT) as Int32Array;
    const prevProg = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
    const prevVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;

    // Offscreen draw
    gl.bindFramebuffer(gl.FRAMEBUFFER, captureFBORef.current);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    // Readback
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    const src = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, src);

    // Restore state
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFB);
    gl.viewport(prevVP[0]!, prevVP[1]!, prevVP[2]!, prevVP[3]!);
    gl.useProgram(prevProg);
    gl.bindVertexArray(prevVAO);

    // Flip Y
    const row = w * 4;
    const dst = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) {
      const s = (h - 1 - y) * row;
      const d = y * row;
      dst.set(src.subarray(s, s + row), d);
    }

    try {
      return new ImageData(dst, w, h, { colorSpace: "srgb" });
    } catch {
      return new ImageData(dst, w, h);
    }
  }, []);

  // Tap handler
  const onPointerUp: React.PointerEventHandler<HTMLCanvasElement> = useCallback(
    (e) => {
      if (!onTap || !layoutRef.current) return;
      const cvs = canvasRef.current!;
      const rect = cvs.getBoundingClientRect();
      const L = layoutRef.current;
      const xCss = e.clientX - rect.left;
      const yCss = e.clientY - rect.top;
      const cx = Math.max(0, Math.min(cvs.width - 1, Math.round(xCss * L.dpr)));
      const cy = Math.max(0, Math.min(cvs.height - 1, Math.round(yCss * L.dpr)));

      const imageData = makeSnapshotImageData();
      if (!imageData) return;
      onTap({ x: cx, y: cy, imageData });
    },
    [onTap, makeSnapshotImageData]
  );

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        position: "relative",
        overflow: "hidden",
        background: "black",
        touchAction: "manipulation",
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerUp={onPointerUp}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          cursor: "crosshair",
        }}
      />
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          left: -10000,
          top: -10000,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}